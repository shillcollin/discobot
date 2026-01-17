/**
 * UIMessage Stream Protocol handler.
 *
 * This module provides utilities for generating UIMessageChunk events
 * that conform to the Vercel AI SDK's UIMessage Stream protocol v1.
 *
 * The protocol requires proper start/delta/end sequences for:
 * - Text: text-start → text-delta* → text-end
 * - Reasoning: reasoning-start → reasoning-delta* → reasoning-end
 * - Tools: tool-input-start → tool-input-available → tool-output-available
 * - Message: start → ... → finish
 */

import type {
	SessionUpdate,
	ToolCall,
	ToolCallContent,
	ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import type { ProviderMetadata, UIMessageChunk } from "ai";

/**
 * Claude Code specific metadata extension.
 * Claude Code uses _meta.claudeCode to provide additional tool information
 * that isn't part of the standard ACP spec.
 */
interface ClaudeCodeMeta {
	/** The actual tool name (e.g., "Bash", "Read", "Edit") */
	toolName?: string;
	/** Raw tool response with stdout/stderr for terminal tools */
	toolResponse?: {
		stdout?: string;
		stderr?: string;
		interrupted?: boolean;
		isImage?: boolean;
	};
}

/**
 * Extract Claude Code metadata from ACP _meta field.
 */
function getClaudeCodeMeta(
	meta?: { [key: string]: unknown } | null,
): ClaudeCodeMeta | undefined {
	if (!meta || typeof meta !== "object") return undefined;
	const claudeCode = meta.claudeCode;
	if (!claudeCode || typeof claudeCode !== "object") return undefined;
	return claudeCode as ClaudeCodeMeta;
}

/**
 * Extract the tool name from an ACP tool call/update.
 * Priority: standard field (none in ACP) → _meta.claudeCode.toolName → title → "unknown"
 */
function extractToolName(
	title?: string,
	meta?: { [key: string]: unknown } | null,
): string {
	const claudeCode = getClaudeCodeMeta(meta);
	// Prefer Claude Code's toolName (actual tool like "Bash")
	// Fall back to title (display name like "`ls -la`")
	return claudeCode?.toolName || title || "unknown";
}

/**
 * Extract the display title from an ACP tool call/update.
 * This is the human-readable description (e.g., "`ls -la /tmp`").
 */
function extractTitle(title?: string): string | undefined {
	return title;
}

/**
 * Extract tool output from an ACP tool call/update.
 * Priority: rawOutput → _meta.claudeCode.toolResponse → content array → undefined
 */
function extractToolOutput(
	rawOutput: unknown,
	content?: Array<ToolCallContent> | null,
	meta?: { [key: string]: unknown } | null,
): unknown {
	// 1. Standard ACP field
	if (rawOutput !== undefined && rawOutput !== null) {
		return rawOutput;
	}

	// 2. Claude Code specific: toolResponse in _meta
	const claudeCode = getClaudeCodeMeta(meta);
	if (claudeCode?.toolResponse) {
		return claudeCode.toolResponse;
	}

	// 3. Extract from content array (formatted output)
	if (content && content.length > 0) {
		// Try to extract text from content blocks
		const textParts: string[] = [];
		for (const item of content) {
			if (item.type === "content" && item.content) {
				const block = item.content;
				if (block && typeof block === "object" && "text" in block) {
					textParts.push((block as { text: string }).text);
				}
			}
		}
		if (textParts.length > 0) {
			return textParts.join("\n");
		}
	}

	return undefined;
}

/**
 * Build providerMetadata from Claude Code _meta for input events.
 * This allows the UI to access Claude-specific information.
 */
function buildProviderMetadata(
	meta?: { [key: string]: unknown } | null,
): ProviderMetadata | undefined {
	const claudeCode = getClaudeCodeMeta(meta);
	if (!claudeCode) return undefined;
	// Cast to expected type - claudeCode metadata is JSON-serializable
	return { claudeCode } as unknown as ProviderMetadata;
}

/** Tool state values for tracking emitted events */
type ToolState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error";

/**
 * Tracks state for proper start/delta/end sequences in UIMessage Stream protocol.
 *
 * Each content type (text, reasoning) needs unique IDs for each block.
 * When switching between content types (e.g., text → tool → text),
 * we must close the current block and start a new one with a new ID.
 */
export interface StreamState {
	/** Current text block ID, null if no text block is open */
	currentTextBlockId: string | null;
	/** Current reasoning block ID, null if no reasoning block is open */
	currentReasoningBlockId: string | null;
	/** Counter for generating unique text block IDs */
	textBlockCounter: number;
	/** Counter for generating unique reasoning block IDs */
	reasoningBlockCounter: number;
	/** Map of toolCallId → last emitted state to avoid duplicate events */
	toolStates: Map<string, ToolState>;
}

/**
 * Creates initial stream state.
 */
export function createStreamState(): StreamState {
	return {
		currentTextBlockId: null,
		currentReasoningBlockId: null,
		textBlockCounter: 0,
		reasoningBlockCounter: 0,
		toolStates: new Map(),
	};
}

/**
 * Message ID container for generating block IDs.
 */
export interface StreamBlockIds {
	messageId: string;
}

/**
 * Creates block IDs container from a message ID.
 */
export function createBlockIds(messageId: string): StreamBlockIds {
	return { messageId };
}

/**
 * Generates a unique text block ID.
 */
function generateTextBlockId(state: StreamState, ids: StreamBlockIds): string {
	state.textBlockCounter++;
	return `text-${ids.messageId}-${state.textBlockCounter}`;
}

/**
 * Generates a unique reasoning block ID.
 */
function generateReasoningBlockId(
	state: StreamState,
	ids: StreamBlockIds,
): string {
	state.reasoningBlockCounter++;
	return `reasoning-${ids.messageId}-${state.reasoningBlockCounter}`;
}

/**
 * Generates the message start chunk.
 */
export function createStartChunk(messageId: string): UIMessageChunk {
	return {
		type: "start",
		messageId,
	};
}

/**
 * Closes any open non-text blocks (reasoning) before text content.
 * Returns chunks to close those blocks.
 */
function closeNonTextBlocks(state: StreamState): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	if (state.currentReasoningBlockId) {
		chunks.push({
			type: "reasoning-end",
			id: state.currentReasoningBlockId,
		});
		state.currentReasoningBlockId = null;
	}

	return chunks;
}

/**
 * Closes any open non-reasoning blocks (text) before reasoning content.
 * Returns chunks to close those blocks.
 */
function closeNonReasoningBlocks(state: StreamState): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	if (state.currentTextBlockId) {
		chunks.push({
			type: "text-end",
			id: state.currentTextBlockId,
		});
		state.currentTextBlockId = null;
	}

	return chunks;
}

/**
 * Closes any open text/reasoning blocks before tool content.
 * Returns chunks to close those blocks.
 */
function closeContentBlocks(state: StreamState): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	if (state.currentTextBlockId) {
		chunks.push({
			type: "text-end",
			id: state.currentTextBlockId,
		});
		state.currentTextBlockId = null;
	}

	if (state.currentReasoningBlockId) {
		chunks.push({
			type: "reasoning-end",
			id: state.currentReasoningBlockId,
		});
		state.currentReasoningBlockId = null;
	}

	return chunks;
}

/**
 * Generates chunks for a text part.
 * - Closes any open reasoning block first
 * - Opens a new text block if none is open
 * - Emits text-delta
 */
export function createTextChunks(
	text: string,
	state: StreamState,
	ids: StreamBlockIds,
): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	// Close reasoning if open (switching content types)
	chunks.push(...closeNonTextBlocks(state));

	// Open new text block if needed
	if (!state.currentTextBlockId) {
		const blockId = generateTextBlockId(state, ids);
		state.currentTextBlockId = blockId;
		chunks.push({
			type: "text-start",
			id: blockId,
		});
	}

	chunks.push({
		type: "text-delta",
		id: state.currentTextBlockId,
		delta: text,
	});

	return chunks;
}

/**
 * Generates chunks for a reasoning part.
 * - Closes any open text block first
 * - Opens a new reasoning block if none is open
 * - Emits reasoning-delta
 */
export function createReasoningChunks(
	text: string,
	state: StreamState,
	ids: StreamBlockIds,
): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	// Close text if open (switching content types)
	chunks.push(...closeNonReasoningBlocks(state));

	// Open new reasoning block if needed
	if (!state.currentReasoningBlockId) {
		const blockId = generateReasoningBlockId(state, ids);
		state.currentReasoningBlockId = blockId;
		chunks.push({
			type: "reasoning-start",
			id: blockId,
		});
	}

	chunks.push({
		type: "reasoning-delta",
		id: state.currentReasoningBlockId,
		delta: text,
	});

	return chunks;
}

/**
 * Maps ACP tool status to stream state.
 */
function toolStatusToState(
	status?: "pending" | "in_progress" | "completed" | "failed" | null,
): ToolState {
	switch (status) {
		case "completed":
			return "output-available";
		case "failed":
			return "output-error";
		case "in_progress":
			return "input-available";
		default:
			return "input-streaming";
	}
}

/**
 * Generates chunks for an ACP ToolCall.
 * - Closes any open text/reasoning blocks first
 * - Returns appropriate tool events based on state.
 * - Extracts tool metadata from standard ACP fields first, then Claude Code extensions.
 */
export function createToolCallChunks(
	toolCall: ToolCall,
	state: StreamState,
): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	// Close any open text/reasoning blocks before tool content
	chunks.push(...closeContentBlocks(state));

	const prevState = state.toolStates.get(toolCall.toolCallId);
	const currentState = toolStatusToState(toolCall.status);

	// Extract fields with fallbacks to Claude Code extensions
	const toolName = extractToolName(toolCall.title, toolCall._meta);
	const title = extractTitle(toolCall.title);
	const providerMetadata = buildProviderMetadata(toolCall._meta);

	// Send tool-input-start on first encounter
	if (!prevState) {
		chunks.push({
			type: "tool-input-start",
			toolCallId: toolCall.toolCallId,
			toolName,
			title,
			providerMetadata,
			dynamic: true,
		});
	}

	// Emit appropriate event based on state transition
	if (currentState === "input-available" && prevState !== "input-available") {
		chunks.push({
			type: "tool-input-available",
			toolCallId: toolCall.toolCallId,
			toolName,
			title,
			input: toolCall.rawInput || {},
			providerMetadata,
			dynamic: true,
		});
	} else if (
		currentState === "output-available" &&
		prevState !== "output-available"
	) {
		const output = extractToolOutput(
			toolCall.rawOutput,
			toolCall.content,
			toolCall._meta,
		);
		chunks.push({
			type: "tool-output-available",
			toolCallId: toolCall.toolCallId,
			output,
			dynamic: true,
		});
	} else if (currentState === "output-error" && prevState !== "output-error") {
		const output = extractToolOutput(
			toolCall.rawOutput,
			toolCall.content,
			toolCall._meta,
		);
		chunks.push({
			type: "tool-output-error",
			toolCallId: toolCall.toolCallId,
			errorText: String(output || "Tool call failed"),
			dynamic: true,
		});
	}

	// Update tracked state
	state.toolStates.set(toolCall.toolCallId, currentState);

	return chunks;
}

/**
 * Generates chunks for an ACP ToolCallUpdate.
 * - Closes any open text/reasoning blocks first
 * - Returns appropriate tool events based on state changes.
 * - Extracts tool metadata from standard ACP fields first, then Claude Code extensions.
 */
export function createToolCallUpdateChunks(
	update: ToolCallUpdate,
	state: StreamState,
): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	// Close any open text/reasoning blocks before tool content
	chunks.push(...closeContentBlocks(state));

	const prevState = state.toolStates.get(update.toolCallId);
	const currentState = toolStatusToState(update.status);

	// Extract fields with fallbacks to Claude Code extensions
	const toolName = extractToolName(update.title ?? undefined, update._meta);
	const title = extractTitle(update.title ?? undefined);
	const providerMetadata = buildProviderMetadata(update._meta);

	// Send tool-input-start on first encounter
	if (!prevState) {
		chunks.push({
			type: "tool-input-start",
			toolCallId: update.toolCallId,
			toolName,
			title,
			providerMetadata,
			dynamic: true,
		});
	}

	// Emit appropriate event based on state transition
	if (currentState === "input-available" && prevState !== "input-available") {
		chunks.push({
			type: "tool-input-available",
			toolCallId: update.toolCallId,
			toolName,
			title,
			input: update.rawInput || {},
			providerMetadata,
			dynamic: true,
		});
	} else if (
		currentState === "output-available" &&
		prevState !== "output-available"
	) {
		const output = extractToolOutput(
			update.rawOutput,
			update.content,
			update._meta,
		);
		chunks.push({
			type: "tool-output-available",
			toolCallId: update.toolCallId,
			output,
			dynamic: true,
		});
	} else if (currentState === "output-error" && prevState !== "output-error") {
		const output = extractToolOutput(
			update.rawOutput,
			update.content,
			update._meta,
		);
		chunks.push({
			type: "tool-output-error",
			toolCallId: update.toolCallId,
			errorText: String(output || "Tool call failed"),
			dynamic: true,
		});
	}

	// Update tracked state
	state.toolStates.set(update.toolCallId, currentState);

	return chunks;
}

/**
 * Generates finish chunks (text-end, reasoning-end, finish).
 * Closes any open blocks and emits the finish event.
 */
export function createFinishChunks(
	state: StreamState,
	_ids: StreamBlockIds,
): UIMessageChunk[] {
	const chunks: UIMessageChunk[] = [];

	// Close any open blocks
	chunks.push(...closeContentBlocks(state));

	chunks.push({
		type: "finish",
	});

	return chunks;
}

/**
 * Creates an error chunk.
 */
export function createErrorChunk(errorText: string): UIMessageChunk {
	return {
		type: "error",
		errorText,
	};
}

/**
 * Generates UIMessageChunks for an ACP SessionUpdate.
 * Returns empty array for unhandled update types.
 */
export function sessionUpdateToChunks(
	update: SessionUpdate,
	state: StreamState,
	ids: StreamBlockIds,
): UIMessageChunk[] {
	switch (update.sessionUpdate) {
		case "agent_message_chunk":
			if (update.content.type === "text") {
				return createTextChunks(update.content.text, state, ids);
			}
			break;

		case "agent_thought_chunk":
			if (update.content.type === "text") {
				return createReasoningChunks(update.content.text, state, ids);
			}
			break;

		case "tool_call":
			return createToolCallChunks(update, state);

		case "tool_call_update":
			return createToolCallUpdateChunks(update, state);
	}

	return [];
}
