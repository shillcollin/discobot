/**
 * WebSocket Proxy
 *
 * Proxies WebSocket connections to local service ports.
 * Works with Bun's native WebSocket support.
 */

const DEBUG = true;

function log(message: string, data?: Record<string, unknown>): void {
	if (!DEBUG) return;
	const timestamp = new Date().toISOString();
	if (data) {
		console.log(
			`[${timestamp}] [ws-proxy] ${message}`,
			JSON.stringify(data, null, 2),
		);
	} else {
		console.log(`[${timestamp}] [ws-proxy] ${message}`);
	}
}

/**
 * Data attached to each WebSocket connection for tracking
 */
export interface WebSocketData {
	targetUrl: string;
	serviceId: string;
	target?: WebSocket;
	/** Buffer for messages received before target is connected */
	pendingMessages?: (string | ArrayBuffer)[];
	/** Whether the target connection is ready */
	targetReady?: boolean;
}

/**
 * Bun WebSocket interface (subset we use)
 */
interface BunWebSocket {
	data: WebSocketData;
	send(data: string | ArrayBuffer | Uint8Array): void;
	close(code?: number, reason?: string): void;
	readyState: number;
}

/**
 * Create WebSocket handlers for Bun.serve
 *
 * These handlers manage the client-side WebSocket and bridge
 * messages to/from the target service WebSocket.
 */
export function createBunWebSocketHandler() {
	return {
		/**
		 * Called when a client WebSocket connection is opened.
		 * We connect to the target service and set up bidirectional bridging.
		 */
		open(ws: BunWebSocket) {
			const { targetUrl, serviceId } = ws.data;
			log("Client WebSocket opened", { targetUrl, serviceId });

			// Initialize pending message buffer
			ws.data.pendingMessages = [];
			ws.data.targetReady = false;

			// Connect to target service
			const target = new WebSocket(targetUrl);
			ws.data.target = target;

			target.onopen = () => {
				log("Target WebSocket connected", { targetUrl });
				ws.data.targetReady = true;

				// Flush any pending messages
				const pending = ws.data.pendingMessages || [];
				if (pending.length > 0) {
					log("Flushing pending messages", { count: pending.length });
					for (const msg of pending) {
						target.send(msg);
					}
					ws.data.pendingMessages = [];
				}
			};

			target.onmessage = (event) => {
				// Forward messages from target to client
				if (ws.readyState === WebSocket.OPEN) {
					ws.send(event.data);
					log("Target -> Client", {
						size:
							typeof event.data === "string"
								? event.data.length
								: event.data.byteLength,
					});
				}
			};

			target.onclose = (event) => {
				log("Target WebSocket closed", {
					code: event.code,
					reason: event.reason,
				});
				if (ws.readyState === WebSocket.OPEN) {
					ws.close(event.code, event.reason);
				}
			};

			target.onerror = () => {
				log("Target WebSocket error");
				if (ws.readyState === WebSocket.OPEN) {
					ws.close(1011, "Target error");
				}
			};
		},

		/**
		 * Called when the client sends a message.
		 * Forward to the target service, or buffer if not ready.
		 */
		message(ws: BunWebSocket, message: string | ArrayBuffer) {
			const target = ws.data.target;

			// If target is ready, send immediately
			if (
				ws.data.targetReady &&
				target &&
				target.readyState === WebSocket.OPEN
			) {
				target.send(message);
				log("Client -> Target", {
					size:
						typeof message === "string" ? message.length : message.byteLength,
				});
			} else {
				// Buffer the message until target is ready
				if (!ws.data.pendingMessages) {
					ws.data.pendingMessages = [];
				}
				ws.data.pendingMessages.push(message);
				log("Client message buffered - target not ready", {
					bufferedCount: ws.data.pendingMessages.length,
					hasTarget: !!target,
					readyState: target?.readyState,
				});
			}
		},

		/**
		 * Called when the client WebSocket closes.
		 * Close the target connection too.
		 */
		close(ws: BunWebSocket, code: number, reason: string) {
			log("Client WebSocket closed", { code, reason });
			const target = ws.data.target;
			if (target && target.readyState === WebSocket.OPEN) {
				target.close(code, reason);
			}
		},
	};
}
