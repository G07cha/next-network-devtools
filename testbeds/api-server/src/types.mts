export interface MockRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: string;
	query: Record<string, string>;
	timestamp: number;
}

export interface MockResponse {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	delay: number;
	size: number;
	contentType: string;
}

export interface MockLog {
	id: string;
	request: MockRequest;
	response: MockResponse;
	duration: number;
	timestamp: number;
}

export interface MockConfig {
	port: number;
	defaultDelay: number;
	defaultStatus: number;
}

export interface QueryParams {
	status?: string;
	delay?: string;
	contentType?: string;
	headers?: string;
	body?: string;
	error?: string;
	size?: string;
}

export type ContentType = "json" | "xml" | "text" | "html";

export interface ErrorCondition {
	type: "timeout" | "connection" | "server" | "client";
	message: string;
	status: number;
}
