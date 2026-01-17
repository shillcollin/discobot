import type { ContentBlock } from "@agentclientprotocol/sdk";
import type { UIMessage } from "ai";

/** Type alias for UIMessage parts (extracted from UIMessage to avoid generic params) */
type MessagePart = UIMessage["parts"][number];

/**
 * Convert UIMessage parts to ACP ContentBlock array
 */
export function uiMessageToContentBlocks(message: UIMessage): ContentBlock[] {
	const blocks: ContentBlock[] = [];

	for (const part of message.parts) {
		if (part.type === "text") {
			blocks.push({
				type: "text",
				text: part.text,
			});
		} else if (part.type === "file") {
			blocks.push({
				type: "resource_link",
				uri: part.url,
				name: part.filename || "file",
				mimeType: part.mediaType,
			});
		}
	}

	return blocks;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
	return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new UIMessage
 */
export function createUIMessage(
	role: "user" | "assistant",
	parts: MessagePart[] = [],
): UIMessage {
	return {
		id: generateMessageId(),
		role,
		parts,
	};
}
