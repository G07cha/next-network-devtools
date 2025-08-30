import { createServer as createHttpServer } from "node:http";
import { context, propagation, trace } from "@opentelemetry/api";
import type {
	ReadableSpan,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { parse } from "url";
import { type WebSocket, WebSocketServer } from "ws";
import type { ServerEvent } from "@/packages/types";
import { createInterceptor } from "./interceptor";

// Key is requestID
const requestTimings = new Map<string, { startMs: number }>();
const spans = new Map<string, ReadableSpan>();

export const createServer = (spanProcessor: SpanProcessor) => {
	const interceptor = createInterceptor();

	spanProcessor.onStart = (span) => {
		spans.set(span.spanContext().spanId, span);
	};

	spanProcessor.onEnd = (span) => {
		spans.set(span.spanContext().spanId, span);
	};

	const server = createHttpServer((req, res) => {
		const { pathname } = parse(req.url || "", true);

		// Set CORS headers
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");
		res.setHeader("Content-Type", "application/json");

		if (req.method === "OPTIONS") {
			res.writeHead(200);
			res.end();
			return;
		}

		if (req.method === "GET" && pathname === "/spans") {
			res.writeHead(200);
			const serializableSpans = Array.from(spans.values())
				// Filter out unrelated spans
				.filter(
					(span) =>
						typeof span.attributes["http.url"] !== "string" ||
						(!span.attributes["http.url"].startsWith("http://localhost:3300") &&
							!span.attributes["http.url"].includes("/_next/")),
				)
				.map((span) => ({
					name: span.name,
					startTime: span.startTime,
					endTime: span.endTime,
					attributes: span.attributes,
					spanContext: span.spanContext(),
					// Add more fields as needed, avoiding circular references
				}));
			res.end(JSON.stringify(serializableSpans));
			return;
		}

		// 404 for unmatched routes
		res.writeHead(404);
		res.end(JSON.stringify({ error: "Not found" }));
	});

	// --- WebSocket server setup ---
	const wss = new WebSocketServer({ server });
	const clients = new Set<WebSocket>();

	wss.on("connection", (ws: WebSocket) => {
		clients.add(ws);

		ws.on("close", () => {
			clients.delete(ws);
		});
	});

	function broadcast(event: ServerEvent) {
		const message = JSON.stringify(event);
		for (const ws of clients) {
			if (ws.readyState === ws.OPEN) {
				try {
					ws.send(message);
				} catch (e) {
					console.error("Error sending message to client:", e);
					// Remove faulty client
					clients.delete(ws);
				}
			}
		}
	}

	const getSpanContext = (entity: Request | Response) => {
		const extractedContext = propagation.extract(
			context.active(),
			entity.headers,
		);
		let spanId: string | undefined, traceId: string | undefined;
		let parentSpan: { spanId: string; traceId: string } | undefined;
		const activeSpan = trace.getSpan(extractedContext);
		if (activeSpan) {
			const spanContext = activeSpan.spanContext();
			spanId = spanContext.spanId;
			traceId = spanContext.traceId;

			const parentSpanContext = spans.get(spanId)?.parentSpanContext;

			if (parentSpanContext) {
				parentSpan = {
					spanId: parentSpanContext.spanId,
					traceId: parentSpanContext.traceId,
				};
			}
		}
		return { spanId, traceId, parentSpan };
	};

	interceptor.on("request", async (req) => {
		const start = Date.now();
		requestTimings.set(req.requestId, { startMs: Date.now() });
		const context = getSpanContext(req.request);
		const body = req.request.body
			? await req.request.clone().text()
			: undefined;

		broadcast({
			type: "request",
			data: {
				...context,
				id: req.requestId,
				method: req.request.method,
				url: req.request.url,
				headers: Object.fromEntries(req.request.headers.entries()),
				body,
				start,
			},
		});
	});

	interceptor.on("response", async (res) => {
		const context = getSpanContext(res.response);

		const timing = requestTimings.get(res.requestId);
		if (timing) {
			requestTimings.delete(res.requestId);
		}
		const body = res.response.body
			? await res.response.clone().text()
			: undefined;

		broadcast({
			type: "response",
			data: {
				...context,
				id: res.requestId,
				status: res.response.status,
				statusText: res.response.statusText,
				headers: Object.fromEntries(res.response.headers.entries()),
				body: body,
				start: timing?.startMs ?? 0,
				end: Date.now(),
			},
		});
	});

	return server;
};
