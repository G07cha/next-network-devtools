import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { parse } from "node:url";
import { RequestLogger } from "./logger.mts";
import type { MockConfig, MockResponse } from "./types.mts";
import {
	generateResponseBody,
	getContentTypeHeader,
	getErrorCondition,
	getRequestBody,
	getStatusText,
	parseHeaders,
	parseQueryParams,
	validateContentType,
	validateDelay,
	validateStatus,
} from "./utils.mts";

export class MockServer {
	private config: MockConfig;
	private logger: RequestLogger;
	private server: ReturnType<typeof createServer>;

	constructor(config: Partial<MockConfig> = {}) {
		this.config = {
			port: 4000,
			defaultDelay: 0,
			defaultStatus: 200,
			...config,
		};

		this.logger = new RequestLogger();
		this.server = createServer(this.handleRequest.bind(this));
	}

	private async handleRequest(req: IncomingMessage, res: ServerResponse) {
		const startTime = Date.now();

		if (req.method === "OPTIONS") {
			res.writeHead(200);
			res.end();
			return;
		}

		const { pathname, query } = parse(req.url || "", true);

		try {
			// Route handling
			if (pathname === "/api/mock") {
				await this.handleMockRequest(req, res, query, startTime);
			} else {
				this.handle404(res);
			}
		} catch (error) {
			this.handleError(res, error);
		}
	}

	private async handleMockRequest(
		req: IncomingMessage,
		res: ServerResponse,
		query: Record<string, string | string[] | undefined>,
		startTime: number,
	) {
		const params = parseQueryParams(query || {});
		const method = req.method || "GET";
		const url = req.url || "";

		// Get request body
		let body: string | undefined;
		if (["POST", "PUT", "PATCH"].includes(method)) {
			body = await getRequestBody(req);
		}

		this.logger.logRequest(method, url, body, params);

		try {
			// Check for error simulation
			const errorCondition = getErrorCondition(params.error);
			if (errorCondition) {
				const mockResponse: MockResponse = {
					status: errorCondition.status,
					statusText: getStatusText(errorCondition.status),
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ error: errorCondition.message }),
					delay: validateDelay(params.delay),
					size: 0,
					contentType: "json",
				};

				await this.sendMockResponse(res, mockResponse, startTime);
				return;
			}

			// Parse and validate parameters
			const status = validateStatus(params.status) || this.config.defaultStatus;
			const delay = validateDelay(params.delay) || this.config.defaultDelay;
			const contentType = validateContentType(params.contentType);
			const customHeaders = parseHeaders(params.headers);

			// Generate response body
			const responseBody = generateResponseBody(
				contentType,
				params.body,
				params.size,
			);
			const contentTypeHeader = getContentTypeHeader(contentType);

			// Create mock response
			const mockResponse: MockResponse = {
				status,
				statusText: getStatusText(status),
				headers: {
					"content-type": contentTypeHeader,
					...customHeaders,
				},
				body: responseBody,
				delay,
				size: Buffer.byteLength(responseBody, "utf8"),
				contentType,
			};

			await this.sendMockResponse(res, mockResponse, startTime);
		} catch (error) {
			// Handle validation errors
			const errorResponse: MockResponse = {
				status: 400,
				statusText: "Bad Request",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					error:
						error instanceof Error
							? error.message
							: "Invalid request parameters",
				}),
				delay: 0,
				size: 0,
				contentType: "json",
			};

			await this.sendMockResponse(res, errorResponse, startTime);
		}
	}

	private async sendMockResponse(
		res: ServerResponse,
		mockResponse: MockResponse,
		startTime: number,
	) {
		// Apply delay if specified
		if (mockResponse.delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, mockResponse.delay));
		}

		// Set headers
		for (const [key, value] of Object.entries(mockResponse.headers)) {
			res.setHeader(key, value);
		}

		// Send response
		res.writeHead(mockResponse.status);
		res.end(mockResponse.body);

		// Log the response
		this.logger.logResponse(mockResponse, startTime);
	}

	private handle404(res: ServerResponse) {
		res.writeHead(404, { "content-type": "application/json" });
		res.end(
			JSON.stringify({
				error: "Not found",
				availableEndpoints: ["GET/POST/PUT/DELETE/PATCH /api/mock"],
			}),
		);
	}

	private handleError(res: ServerResponse, error: unknown) {
		console.error("Server error:", error);
		res.writeHead(500, { "content-type": "application/json" });
		res.end(
			JSON.stringify({
				error: "Internal server error",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
		);
	}

	public start(): Promise<void> {
		return new Promise((resolve) => {
			this.server.listen(this.config.port, () => {
				console.log(
					`🚀 Mock API Server running on http://localhost:${this.config.port}`,
				);
				console.log(
					"   GET/POST/PUT/DELETE/PATCH /api/mock - Universal mock endpoint",
				);
				console.log(
					`\n🔗 Try: curl "http://localhost:${this.config.port}/api/mock?status=200&body={\\"hello\\":\\"world\\"}"`,
				);
				resolve();
			});
		});
	}

	public stop(): Promise<void> {
		return new Promise((resolve) => {
			this.server.close(() => {
				console.log("Mock API Server stopped");
				resolve();
			});
		});
	}
}
