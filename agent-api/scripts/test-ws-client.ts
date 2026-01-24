/**
 * Test WebSocket client
 *
 * Tests connecting through the proxy to the echo server.
 *
 * Usage:
 *   1. Start the echo server: bun run scripts/test-ws-service.ts
 *   2. Start the agent API: bun run src/index.ts
 *   3. Run this client: bun run scripts/test-ws-client.ts [direct|proxy]
 */

const mode = process.argv[2] || "direct";
const ECHO_PORT = 8765;
const AGENT_PORT = 3002;

let url: string;
if (mode === "proxy") {
	// Connect through the agent API proxy
	// Requires a service with http: 8765 to be configured
	url = `ws://localhost:${AGENT_PORT}/services/test-echo/http/`;
} else {
	// Connect directly to echo server
	url = `ws://localhost:${ECHO_PORT}`;
}

console.log(`Connecting to ${url} (mode: ${mode})...`);

const ws = new WebSocket(url);

ws.onopen = () => {
	console.log("Connected!");

	// Send a test message
	const testMsg = {
		type: "test",
		timestamp: Date.now(),
		data: "Hello from client!",
	};
	console.log("Sending:", JSON.stringify(testMsg));
	ws.send(JSON.stringify(testMsg));
};

ws.onmessage = (event) => {
	console.log("Received:", event.data);
};

ws.onerror = (error) => {
	console.error("WebSocket error:", error);
};

ws.onclose = (event) => {
	console.log("Connection closed:", { code: event.code, reason: event.reason });
	process.exit(0);
};

// Close after 5 seconds
setTimeout(() => {
	console.log("Closing connection...");
	ws.close(1000, "Test complete");
}, 5000);
