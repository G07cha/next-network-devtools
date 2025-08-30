import { MockServer } from "./server.mts";

async function main() {
	const server = new MockServer({
		port: 4000,
		defaultDelay: 0,
		defaultStatus: 200,
	});

	// Handle graceful shutdown
	process.on("SIGINT", async () => {
		console.log("\n🛑 Shutting down server...");
		await server.stop();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		console.log("\n🛑 Shutting down server...");
		await server.stop();
		process.exit(0);
	});

	try {
		await server.start();
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
