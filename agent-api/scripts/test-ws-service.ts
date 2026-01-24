/**
 * Test WebSocket service
 *
 * A simple echo WebSocket server for testing the proxy.
 * Run with: bun run scripts/test-ws-service.ts
 */

const PORT = 8765;

console.log(`Starting test WebSocket echo server on port ${PORT}...`);

Bun.serve({
	port: PORT,
	fetch(req, server) {
		const upgraded = server.upgrade(req);
		if (upgraded) {
			return undefined;
		}
		return new Response(
			`WebSocket echo server. Connect via ws://localhost:${PORT}`,
		);
	},
	websocket: {
		open(ws) {
			console.log("[echo] Client connected");
			ws.send(
				JSON.stringify({
					type: "connected",
					message: "Hello from echo server!",
				}),
			);
		},
		message(ws, message) {
			console.log(
				"[echo] Received:",
				typeof message === "string"
					? message
					: `[binary ${message.byteLength} bytes]`,
			);
			// Echo back the message
			ws.send(message);
		},
		close(_ws, code, reason) {
			console.log("[echo] Client disconnected", { code, reason });
		},
	},
});

console.log(`Echo server listening on ws://localhost:${PORT}`);
