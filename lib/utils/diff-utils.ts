import * as Diff from "diff";

/**
 * Diff size thresholds (in lines)
 * These help prevent UI blocking on very large diffs
 */
export const DIFF_WARNING_THRESHOLD = 10000; // Show warning but allow loading
export const DIFF_HARD_LIMIT = 20000; // Never render, show fallback only

/**
 * Language mapping for Monaco Editor syntax highlighting
 * Maps file extensions to Monaco language identifiers
 */
const LANGUAGE_MAP: Record<string, string> = {
	js: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	cs: "csharp",
	php: "php",
	swift: "swift",
	kt: "kotlin",
	scala: "scala",
	html: "html",
	htm: "html",
	css: "css",
	scss: "scss",
	less: "less",
	json: "json",
	xml: "xml",
	yaml: "yaml",
	yml: "yaml",
	md: "markdown",
	sql: "sql",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	ps1: "powershell",
	dockerfile: "dockerfile",
	makefile: "makefile",
	toml: "toml",
	ini: "ini",
	conf: "ini",
	graphql: "graphql",
	gql: "graphql",
	vue: "vue",
	svelte: "svelte",
};

/**
 * Detect the programming language from a file path for syntax highlighting
 */
export function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase() || "";

	// Check for special filenames
	const filename = filePath.split("/").pop()?.toLowerCase() || "";
	if (filename === "dockerfile") return "dockerfile";
	if (filename === "makefile") return "makefile";
	if (filename.startsWith(".") && !ext) return "plaintext";

	return LANGUAGE_MAP[ext] || "plaintext";
}

/**
 * Reconstruct the original content from current content and a unified diff patch.
 * The patch format is: original -> modified
 * So we need to apply the patch in reverse to go from modified back to original.
 */
export function reconstructOriginalFromPatch(
	currentContent: string,
	patch: string,
): string {
	try {
		// Parse the patch to get the structured patch object
		const parsedPatches = Diff.parsePatch(patch);
		if (parsedPatches.length === 0) {
			return currentContent;
		}

		// The patch goes from old -> new, so we need to reverse it
		// Apply the patch in reverse by swapping additions and deletions
		const reversedPatch = parsedPatches[0];

		// Swap old and new for reverse application
		const originalPatch = {
			...reversedPatch,
			hunks: reversedPatch.hunks.map((hunk) => ({
				...hunk,
				lines: hunk.lines.map((line) => {
					// Swap + and - to reverse the patch
					if (line.startsWith("+")) {
						return `-${line.slice(1)}`;
					}
					if (line.startsWith("-")) {
						return `+${line.slice(1)}`;
					}
					return line;
				}),
				oldStart: hunk.newStart,
				oldLines: hunk.newLines,
				newStart: hunk.oldStart,
				newLines: hunk.oldLines,
			})),
		};

		// Apply the reversed patch to get the original content
		const result = Diff.applyPatch(currentContent, originalPatch);
		return typeof result === "string" ? result : currentContent;
	} catch (error) {
		console.error("Failed to reconstruct original from patch:", error);
		return currentContent;
	}
}

/**
 * Fast count of diff lines without parsing the entire patch.
 * Counts lines that start with ' ', '+', or '-' (diff content lines).
 * This is much faster than parsing for large diffs.
 */
export function countDiffLinesFast(patch: string): number {
	let count = 0;
	let inHunk = false;

	for (const line of patch.split("\n")) {
		// Start of a hunk
		if (line.startsWith("@@")) {
			inHunk = true;
			continue;
		}

		// Count actual diff content lines (context, additions, deletions)
		if (
			inHunk &&
			(line.startsWith(" ") || line.startsWith("+") || line.startsWith("-"))
		) {
			count++;
		}
	}

	return count;
}
