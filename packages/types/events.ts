import type { RequestSpan, ResponseSpan, Span } from "./spans";

export type Event<T = string, D = unknown> = {
	type: T;
	data: D;
};

export type RequestEvent = Event<"request", RequestSpan>;
export type ResponseEvent = Event<"response", ResponseSpan>;
export type SpanStart = Event<"span-start", Span>;
export type SpanEnd = Event<"span-end", Span>;

export type ServerEvent = RequestEvent | ResponseEvent | SpanStart | SpanEnd;
