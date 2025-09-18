import type { RequestSpan, ResponseSpan, Span } from "./spans";

export type Event<T = string, D = undefined> = {
	type: T;
	data: D;
};

export type RequestEvent = Event<"request", RequestSpan>;
export type ResponseEvent = Event<"response", ResponseSpan>;
export type SpanStart = Event<"span-start", Span>;
export type SpanEnd = Event<"span-end", Span>;

export type BroadcastedServerEvents = Exclude<ServerEvent, CatchUpEvent>;
export type CatchUpEvent = Event<"catch-up", BroadcastedServerEvents[]>;

export type ServerEvent =
	| RequestEvent
	| ResponseEvent
	| SpanStart
	| SpanEnd
	| CatchUpEvent;

type ClearAllEvent = Event<"clear-all">;

export type ClientEvent = ClearAllEvent;
