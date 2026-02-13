import type { UIMessage } from "ai";

/**
 * Type guard to check if a message part is a dynamic tool call
 */
export function isToolPart(
	part: UIMessage["parts"][number],
): part is Extract<UIMessage["parts"][number], { type: "dynamic-tool" }> {
	return part.type === "dynamic-tool";
}

/**
 * Groups message parts by type and returns counts for main types only.
 * Only counts: dynamic-tool, text, and reasoning parts.
 * Other part types (file, source-url, etc.) are ignored.
 *
 * @example
 * // Returns: Map { "tool" => 3, "text" => 2, "reasoning" => 1 }
 * groupPartsByType([toolPart, toolPart, toolPart, textPart, textPart, reasoningPart, filePart])
 */
export function groupPartsByType(
	parts: UIMessage["parts"],
): Map<string, number> {
	const counts = new Map<string, number>();

	for (const part of parts) {
		let category: string | null = null;

		switch (part.type) {
			case "dynamic-tool":
				category = "tool";
				break;
			case "text":
				category = "text";
				break;
			case "reasoning":
				category = "reasoning";
				break;
			// Ignore other types (file, source-url, source-document, etc.)
		}

		if (category !== null) {
			const current = counts.get(category) || 0;
			counts.set(category, current + 1);
		}
	}

	return counts;
}

/**
 * Groups tool calls by toolName and returns a map of counts
 *
 * @example
 * // Returns: Map { "Read" => 2, "Write" => 1, "Bash" => 1 }
 * groupToolsByName([readPart, readPart, writePart, bashPart])
 */
export function groupToolsByName(
	parts: UIMessage["parts"],
): Map<string, number> {
	const counts = new Map<string, number>();

	for (const part of parts) {
		if (isToolPart(part)) {
			const current = counts.get(part.toolName) || 0;
			counts.set(part.toolName, current + 1);
		}
	}

	return counts;
}

/**
 * Checks if any tool parts have an error state
 */
export function hasToolErrors(parts: UIMessage["parts"]): boolean {
	return parts.some(
		(part) => isToolPart(part) && part.state === "output-error",
	);
}

/**
 * Formats the part type counts into a human-readable summary string.
 * Shows detailed tool names, and counts for text/reasoning blocks.
 *
 * @example
 * // Returns: "2 Reads, 1 Write, 1 text block, 1 reasoning block"
 * formatPartsSummary(Map { "tool" => 3, "text" => 1, "reasoning" => 1 }, Map { "Read" => 2, "Write" => 1 })
 */
export function formatPartsSummary(
	partCounts: Map<string, number>,
	toolCounts?: Map<string, number>,
): string {
	const parts: string[] = [];

	// Add tool details if available (detailed by tool name)
	if (toolCounts && toolCounts.size > 0) {
		const toolEntries = Array.from(toolCounts.entries());
		// Sort by count descending, then alphabetically
		toolEntries.sort((a, b) => {
			const countDiff = b[1] - a[1];
			if (countDiff !== 0) return countDiff;
			return a[0].localeCompare(b[0]);
		});

		const toolDetails = toolEntries
			.map(([name, count]) => {
				const plural = count > 1 ? "s" : "";
				return `${count} ${name}${plural}`;
			})
			.join(", ");
		parts.push(toolDetails);
	}

	// Add text blocks
	const textCount = partCounts.get("text");
	if (textCount) {
		const plural = textCount > 1 ? "s" : "";
		parts.push(`${textCount} text block${plural}`);
	}

	// Add reasoning blocks
	const reasoningCount = partCounts.get("reasoning");
	if (reasoningCount) {
		const plural = reasoningCount > 1 ? "s" : "";
		parts.push(`${reasoningCount} reasoning block${plural}`);
	}

	return parts.join(", ");
}
