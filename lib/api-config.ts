// Default project ID for anonymous user mode (matches Go backend)
export const PROJECT_ID = "local";

/**
 * Get the backend API base URL.
 *
 * Always uses relative URLs - Next.js proxies to the Go backend via rewrites.
 */
export function getApiBase() {
	return `/api/projects/${PROJECT_ID}`;
}

/**
 * Get the backend WebSocket base URL.
 *
 * Uses current host with ws:// or wss:// protocol.
 */
export function getWsBase() {
	if (typeof window === "undefined") {
		// Server-side rendering - shouldn't be used, but return empty
		return "";
	}

	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/projects/${PROJECT_ID}`;
}
