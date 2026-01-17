import type { SessionNotification } from "@agentclientprotocol/sdk";
import type { UIMessage, UIMessageChunk } from "ai";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import { ACPClient } from "../acp/client.js";
import {
	createUIMessage,
	generateMessageId,
	uiMessageToContentBlocks,
} from "../acp/translate.js";
import type {
	ChatRequest,
	ClearSessionResponse,
	ErrorResponse,
	GetMessagesResponse,
	HealthResponse,
	RootResponse,
} from "../api/types.js";
import { authMiddleware } from "../auth/middleware.js";
import { checkCredentialsChanged } from "../credentials/credentials.js";
import {
	addMessage,
	clearSession,
	getLastAssistantMessage,
	getMessages,
	updateMessage,
} from "../store/session.js";
import {
	createBlockIds,
	createErrorChunk,
	createFinishChunks,
	createStartChunk,
	createStreamState,
	sessionUpdateToChunks,
} from "./stream.js";

// Header name for credentials passed from server
const CREDENTIALS_HEADER = "X-Octobot-Credentials";

export interface AppOptions {
	agentCommand: string;
	agentArgs: string[];
	agentCwd: string;
	enableLogging?: boolean;
	/** Salted hash of shared secret (from OCTOBOT_SECRET env var) for auth enforcement */
	sharedSecretHash?: string;
}

export function createApp(options: AppOptions) {
	const app = new Hono();

	// Create ACP client
	const acpClient = new ACPClient({
		command: options.agentCommand,
		args: options.agentArgs,
		cwd: options.agentCwd,
	});

	if (options.enableLogging) {
		app.use("*", logger());
	}

	// Apply auth middleware if shared secret is configured
	if (options.sharedSecretHash) {
		app.use("*", authMiddleware(options.sharedSecretHash));
	}

	app.get("/", (c) => {
		return c.json<RootResponse>({ status: "ok", service: "agent" });
	});

	app.get("/health", (c) => {
		return c.json<HealthResponse>({
			healthy: true,
			connected: acpClient.isConnected,
		});
	});

	// GET /chat - Return all messages
	app.get("/chat", async (c) => {
		// Ensure session is loaded (which loads past messages)
		if (!acpClient.isConnected) {
			await acpClient.connect();
		}
		await acpClient.ensureSession();

		const messages = getMessages();
		console.log(`GET /chat returning ${messages.length} messages`);
		return c.json<GetMessagesResponse>({ messages });
	});

	// POST /chat - Send messages and stream response
	app.post("/chat", async (c) => {
		const reqId = crypto.randomUUID().slice(0, 8);
		const log = (data: Record<string, unknown>) =>
			console.log(JSON.stringify({ reqId, ...data }));

		const body = await c.req.json<ChatRequest>();
		const { messages: inputMessages } = body;

		if (!inputMessages || !Array.isArray(inputMessages)) {
			return c.json<ErrorResponse>({ error: "messages array required" }, 400);
		}

		// Get the last user message to send
		const lastUserMessage = inputMessages
			.filter((m) => m.role === "user")
			.pop();
		if (!lastUserMessage) {
			return c.json<ErrorResponse>({ error: "No user message found" }, 400);
		}

		// Check for credential changes from header
		const credentialsHeader = c.req.header(CREDENTIALS_HEADER) || null;
		const { changed: credentialsChanged, env: credentialEnv } =
			checkCredentialsChanged(credentialsHeader);

		// If credentials changed, restart with new environment
		if (credentialsChanged) {
			await acpClient.updateEnvironment({ env: credentialEnv });
		}

		// Ensure connected and session exists BEFORE adding messages
		// (ensureSession may clear messages when creating a new session)
		if (!acpClient.isConnected) {
			await acpClient.connect();
		}
		await acpClient.ensureSession();

		// Use the incoming UIMessage directly, ensuring it has an ID
		const userMessage: UIMessage = {
			...lastUserMessage,
			id: lastUserMessage.id || generateMessageId(),
		};
		addMessage(userMessage);

		// Create assistant message placeholder
		const assistantMessage = createUIMessage("assistant");
		addMessage(assistantMessage);

		// Convert to ACP format
		const contentBlocks = uiMessageToContentBlocks(userMessage);

		// Stream SSE response
		return streamSSE(c, async (stream) => {
			let textBuffer = "";

			// Track stream state for proper start/delta/end sequences (UIMessage Stream protocol v1)
			const state = createStreamState();
			const ids = createBlockIds(assistantMessage.id);

			// Helper to log and send typed SSE events
			const sendSSE = async (chunk: UIMessageChunk) => {
				log({ sse: chunk });
				await stream.writeSSE({ data: JSON.stringify(chunk) });
			};

			// Helper to send multiple chunks
			const sendChunks = (chunks: UIMessageChunk[]) => {
				for (const chunk of chunks) {
					sendSSE(chunk);
				}
			};

			// Send message start event (required by UIMessage Stream protocol v1)
			await sendSSE(createStartChunk(assistantMessage.id));

			// Set up update callback to stream responses
			acpClient.setUpdateCallback((params: SessionNotification) => {
				const update = params.update;

				// Log session update from ACP
				log({ sessionUpdate: update });

				// Generate stream chunks from the ACP update
				const chunks = sessionUpdateToChunks(update, state, ids);

				// Update the assistant message in store based on update type
				const currentMsg = getLastAssistantMessage();
				if (currentMsg) {
					if (
						update.sessionUpdate === "agent_message_chunk" &&
						update.content.type === "text"
					) {
						// Accumulate text
						textBuffer += update.content.text;
						const existingTextPart = currentMsg.parts.find(
							(p) => p.type === "text",
						);
						if (existingTextPart && existingTextPart.type === "text") {
							existingTextPart.text = textBuffer;
						} else {
							currentMsg.parts.push({ type: "text", text: textBuffer });
						}
						updateMessage(currentMsg.id, { parts: currentMsg.parts });
					} else if (
						update.sessionUpdate === "tool_call" ||
						update.sessionUpdate === "tool_call_update"
					) {
						// Update or add tool invocation
						const toolCallId = update.toolCallId;
						const existingToolPart = currentMsg.parts.find(
							(p) => p.type === "dynamic-tool" && p.toolCallId === toolCallId,
						);
						if (existingToolPart && existingToolPart.type === "dynamic-tool") {
							existingToolPart.toolName =
								update.title || existingToolPart.toolName;
							if (update.rawInput !== undefined) {
								existingToolPart.input = update.rawInput;
							}
							if (update.status === "completed") {
								existingToolPart.state = "output-available";
								existingToolPart.output = update.rawOutput;
							} else if (update.status === "failed") {
								existingToolPart.state = "output-error";
								existingToolPart.errorText = String(
									update.rawOutput || "Tool call failed",
								);
							} else if (update.status === "in_progress") {
								existingToolPart.state = "input-available";
							}
						} else {
							currentMsg.parts.push({
								type: "dynamic-tool",
								toolCallId,
								toolName: update.title || "unknown",
								state: "input-streaming",
								input: update.rawInput,
							});
						}
						updateMessage(currentMsg.id, { parts: currentMsg.parts });
					} else if (
						update.sessionUpdate === "agent_thought_chunk" &&
						update.content.type === "text"
					) {
						currentMsg.parts.push({
							type: "reasoning",
							text: update.content.text,
						});
						updateMessage(currentMsg.id, { parts: currentMsg.parts });
					}
				}

				// Send SSE events (handles start/delta/end sequences)
				sendChunks(chunks);
			});

			try {
				// Send prompt to ACP
				await acpClient.prompt(contentBlocks);

				// Send finish chunks (text-end, reasoning-end, finish)
				for (const chunk of createFinishChunks(state, ids)) {
					await sendSSE(chunk);
				}
			} catch (error) {
				// Extract error message from various error types (including JSON-RPC errors)
				let errorText = "Unknown error";
				if (error instanceof Error) {
					errorText = error.message;
				} else if (error && typeof error === "object") {
					const errorObj = error as Record<string, unknown>;
					if (typeof errorObj.message === "string") {
						errorText = errorObj.message;
						// Include details from data.details if available (JSON-RPC format)
						if (errorObj.data && typeof errorObj.data === "object") {
							const data = errorObj.data as Record<string, unknown>;
							if (typeof data.details === "string") {
								errorText = `${errorText}: ${data.details}`;
							}
						}
					}
				}

				// Send error event
				await sendSSE(createErrorChunk(errorText));
			} finally {
				acpClient.setUpdateCallback(null);
			}
		});
	});

	// DELETE /chat - Clear session and messages
	app.delete("/chat", async (c) => {
		await clearSession();
		return c.json<ClearSessionResponse>({ success: true });
	});

	return { app, acpClient };
}
