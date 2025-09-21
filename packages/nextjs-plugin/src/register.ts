import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { createServer } from "./server";

const inMemorySpanExporter = new InMemorySpanExporter();
const simpleSpanProcessor = new SimpleSpanProcessor(inMemorySpanExporter);

export function register() {
	const sdk = new NodeSDK({
		spanProcessor: simpleSpanProcessor,
		instrumentations: [getNodeAutoInstrumentations()],
	});

	sdk.start();
	startLocalServer();
}

// Start local server which responds with spans & metrics
function startLocalServer() {
	const server = createServer(simpleSpanProcessor);
	server.listen(3300, () => {
		console.log("NextNetwork: Plugin server running on http://localhost:3300");
	});
}
