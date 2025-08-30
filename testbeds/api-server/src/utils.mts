import type { IncomingMessage } from "node:http";
import type { ContentType, ErrorCondition, QueryParams } from "./types.mts";

export function parseQueryParams(
	query: Record<string, string | string[] | undefined>,
): QueryParams {
	const params: QueryParams = {};

	for (const [key, value] of Object.entries(query)) {
		if (typeof value === "string") {
			params[key as keyof QueryParams] = value;
		} else if (Array.isArray(value) && value.length > 0) {
			params[key as keyof QueryParams] = value[0];
		}
	}

	return params;
}

export function validateStatus(status?: string): number {
	if (!status) return 200;
	const parsed = parseInt(status, 10);
	if (Number.isNaN(parsed) || parsed < 100 || parsed > 599) {
		throw new Error(`Invalid status code: ${status}. Must be between 100-599.`);
	}
	return parsed;
}

export function validateDelay(delay?: string): number {
	if (!delay) return 0;
	const parsed = parseInt(delay, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		throw new Error(`Invalid delay: ${delay}. Must be a non-negative number.`);
	}
	return parsed;
}

export function validateContentType(contentType?: string): ContentType {
	if (!contentType) return "json";
	const validTypes: ContentType[] = ["json", "xml", "text", "html"];
	if (!validTypes.includes(contentType as ContentType)) {
		throw new Error(
			`Invalid content type: ${contentType}. Must be one of: ${validTypes.join(", ")}`,
		);
	}
	return contentType as ContentType;
}

export function parseHeaders(headersStr?: string): Record<string, string> {
	if (!headersStr) return {};

	try {
		const parsed = JSON.parse(headersStr);
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		) {
			throw new Error("Headers must be a valid JSON object");
		}
		return parsed;
	} catch (error) {
		throw new Error(
			`Invalid headers JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

export function generateResponseBody(
	contentType: ContentType,
	body?: string,
	size?: string,
): string {
	const targetSize = size ? parseInt(size, 10) : undefined;

	if (body) {
		return targetSize ? padContent(body, targetSize) : body;
	}

	// Generate default content based on type
	switch (contentType) {
		case "json":
			return generateJsonContent(targetSize);
		case "xml":
			return generateXmlContent(targetSize);
		case "html":
			return generateHtmlContent(targetSize);
		case "text":
		default:
			return generateTextContent(targetSize);
	}
}

function generateJsonContent(size?: number): string {
	const baseContent: {
		message: string;
		timestamp: string;
		status: string;
		data: {
			id: number;
			name: string;
			value: number;
			padding?: string;
		};
	} = {
		message: "Mock API response",
		timestamp: new Date().toISOString(),
		status: "success",
		data: {
			id: Math.floor(Math.random() * 1000),
			name: "Generated data",
			value: Math.random(),
		},
	};

	let content = JSON.stringify(baseContent, null, 2);

	if (size && size > content.length) {
		const padding = "x".repeat(size - content.length - 20);
		baseContent.data = { ...baseContent.data, padding };
		content = JSON.stringify(baseContent, null, 2);
	}

	return content;
}

function generateXmlContent(size?: number): string {
	const baseContent = `<?xml version="1.0" encoding="UTF-8"?>
<response>
	<message>Mock API response</message>
	<timestamp>${new Date().toISOString()}</timestamp>
	<status>success</status>
	<data>
		<id>${Math.floor(Math.random() * 1000)}</id>
		<name>Generated data</name>
		<value>${Math.random()}</value>
	</data>
</response>`;

	return size && size > baseContent.length
		? baseContent + `\n<!-- ${"x".repeat(size - baseContent.length - 10)} -->`
		: baseContent;
}

function generateHtmlContent(size?: number): string {
	const baseContent = `<!DOCTYPE html>
<html>
<head>
	<title>Mock API Response</title>
</head>
<body>
	<h1>Mock API Response</h1>
	<p>Timestamp: ${new Date().toISOString()}</p>
	<p>Status: success</p>
	<p>Generated ID: ${Math.floor(Math.random() * 1000)}</p>
</body>
</html>`;

	return size && size > baseContent.length
		? baseContent.replace(
				"</body>",
				`<div>${"x".repeat(size - baseContent.length - 20)}</div></body>`,
			)
		: baseContent;
}

function generateTextContent(size?: number): string {
	const baseContent = `Mock API Response
Timestamp: ${new Date().toISOString()}
Status: success
Generated ID: ${Math.floor(Math.random() * 1000)}`;

	return size && size > baseContent.length
		? baseContent + "\n" + "x".repeat(size - baseContent.length - 1)
		: baseContent;
}

function padContent(content: string, targetSize: number): string {
	if (content.length >= targetSize) return content;
	return content + "\n" + "x".repeat(targetSize - content.length - 1);
}

export function getContentTypeHeader(contentType: ContentType): string {
	switch (contentType) {
		case "json":
			return "application/json";
		case "xml":
			return "application/xml";
		case "html":
			return "text/html";
		case "text":
		default:
			return "text/plain";
	}
}

const statusTexts: Record<number, string> = {
	200: "OK",
	201: "Created",
	202: "Accepted",
	204: "No Content",
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	409: "Conflict",
	422: "Unprocessable Entity",
	429: "Too Many Requests",
	500: "Internal Server Error",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
};

export function getStatusText(status: number): string {
	return statusTexts[status] || "Unknown";
}

export function getErrorCondition(errorType?: string): ErrorCondition | null {
	if (!errorType) return null;

	const errorConditions: Record<string, ErrorCondition> = {
		timeout: {
			type: "timeout",
			message: "Request timeout",
			status: 504,
		},
		connection: {
			type: "connection",
			message: "Connection failed",
			status: 502,
		},
		server: {
			type: "server",
			message: "Internal server error",
			status: 500,
		},
		client: {
			type: "client",
			message: "Bad request",
			status: 400,
		},
	};

	return errorConditions[errorType] || null;
}

export function formatDuration(start: number, end: number): number {
	return Math.round((end - start) * 100) / 100;
}

export const getRequestBody = (req: IncomingMessage): Promise<string> => {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk: Buffer) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			resolve(body);
		});
		req.on("error", reject);
	});
};
