export interface Span {
	id: string;
	start: number;
	end?: number;
	spanId: string | undefined;
	traceId: string | undefined;
	parentSpan:
		| {
				spanId: string;
				traceId: string;
		  }
		| undefined;
}

export interface RequestSpan extends Span {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: string | undefined;
}

export interface ResponseSpan extends Span {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string | undefined;
}
