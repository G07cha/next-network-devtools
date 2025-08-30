import type { RequestSpan, ResponseSpan } from "./spans";

export type Event<T = string, D = unknown> = {
	type: T;
	data: D;
};

export type RequestEvent = Event<"request", RequestSpan>;
export type ResponseEvent = Event<"response", ResponseSpan>;

export type ServerEvent = RequestEvent | ResponseEvent;
