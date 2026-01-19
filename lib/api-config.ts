// Default project ID for anonymous user mode (matches Go backend)
export const PROJECT_ID = "local";

/**
 * Get the backend API base URL.
 *
 * In Next.js dev mode, we connect directly to the Go backend at localhost:3001
 * to bypass the Next.js proxy which has issues with SSE and streaming.
 *
 * In Tauri (production), we use relative URLs since Tauri handles routing.
 */
export function getApiBase() {
	if (typeof window === "undefined") {
		// Server-side rendering - use relative URL
		return `/api/projects/${PROJECT_ID}`;
	}

	// Check if running in Tauri
	const isTauri = "__TAURI__" in window;
	if (isTauri) {
		// Tauri handles routing to the backend
		return `/api/projects/${PROJECT_ID}`;
	}

	// Next.js dev mode - connect directly to Go backend
	return `http://localhost:3001/api/projects/${PROJECT_ID}`;
}
