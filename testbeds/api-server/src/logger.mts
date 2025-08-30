import type { MockResponse, QueryParams } from "./types.mts";
import { formatDuration } from "./utils.mts";

export class RequestLogger {
	logRequest(
		method: string,
		url: string,
		body?: string,
		query: QueryParams = {},
	) {
		const timestamp = new Date().toISOString();

		console.log(`📥 [${timestamp}] ${method} ${url}`);
		if (Object.keys(query).length > 0) {
			console.log(`   Query:`, query);
		}
		if (body) {
			console.log(
				`   Body:`,
				body.length > 200 ? `${body.slice(0, 200)}...` : body,
			);
		}
	}

	logResponse(response: MockResponse, startTime: number): void {
		const endTime = Date.now();
		const duration = formatDuration(startTime, endTime);
		const timestamp = new Date().toISOString();

		const statusColor =
			response.status >= 400 ? "🔴" : response.status >= 300 ? "🟡" : "🟢";
		console.log(
			`📤 [${timestamp}] ${statusColor} ${response.status} ${response.statusText} (${duration}ms)`,
		);
		console.log(
			`   Content-Type: ${response.contentType} | Size: ${response.size} bytes | Delay: ${response.delay}ms`,
		);

		if (response.body && response.body.length <= 500) {
			console.log(`   Response:`, response.body);
		} else if (response.body) {
			console.log(`   Response: ${response.body.slice(0, 200)}... (truncated)`);
		}
		console.log(""); // Empty line for readability
	}
}
