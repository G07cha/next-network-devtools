import type {
	RequestSpan,
	ResponseSpan,
	ServerEvent,
	Span,
} from "@/packages/types";
import { assertType } from "./type";

type AnySpan = RequestSpan | ResponseSpan | Span;

const isRequestSpan = (span: AnySpan): span is RequestSpan => "url" in span;
const isResponseSpan = (span: AnySpan): span is ResponseSpan =>
	"status" in span;

export type SpanNode = {
	// Server span data (from span-start/span-end events)
	serverSpan?: {
		start?: Span;
		end?: Span;
		isActive: boolean;
	};
	request?: RequestSpan;
	response?: ResponseSpan;
	// Hierarchical structure
	children: SpanNode[];
	// Metadata for organization
	spanId?: string;
	parentSpanId?: string;
	isServerSpan: boolean;
};

export type SpanTree = Record<string, SpanNode>;

// Temporary storage for span-end events that arrive before span-start
const pendingEndEvents = new Map<string, Span>();

export const mapServerEventToSpanTree = (
	event: ServerEvent,
	spanTree: SpanTree,
): SpanTree => {
	const { type, data } = event;

	switch (type) {
		case "span-start": {
			// Handle server span start events
			const spanId = data.spanId;
			const parentSpanId = data.parentSpan?.spanId;

			if (spanId) {
				const existingNode = spanTree[spanId] || {
					children: [],
					isServerSpan: true,
					spanId,
					parentSpanId,
				};

				existingNode.serverSpan = {
					start: data,
					isActive: true,
				};
				existingNode.isServerSpan = true;
				existingNode.spanId = spanId;
				existingNode.parentSpanId = parentSpanId;

				// Check for pending end event
				if (pendingEndEvents.has(spanId)) {
					existingNode.serverSpan.end = pendingEndEvents.get(spanId);
					existingNode.serverSpan.isActive = false;
					pendingEndEvents.delete(spanId);
				}

				spanTree[spanId] = existingNode;

				// If this server span has a parent server span, establish hierarchy
				if (
					parentSpanId &&
					spanTree[parentSpanId] &&
					spanTree[parentSpanId].isServerSpan
				) {
					const parentNode = spanTree[parentSpanId];
					// Check if this server span is already a child of the parent
					if (!parentNode.children.some((child) => child.spanId === spanId)) {
						parentNode.children.push(existingNode);
					}
				}

				// Check if any existing orphaned children should be attached to this parent
				for (const [nodeId, node] of Object.entries(spanTree)) {
					if (
						nodeId !== spanId &&
						node.parentSpanId === spanId &&
						node.isServerSpan &&
						!existingNode.children.some((child) => child.spanId === nodeId)
					) {
						existingNode.children.push(node);
					}
				}
			}
			break;
		}
		case "span-end": {
			// Handle server span end events
			const spanId = data.spanId;
			const parentSpanId = data.parentSpan?.spanId;

			if (spanId && spanTree[spanId]) {
				const existingNode = spanTree[spanId];
				if (existingNode.serverSpan) {
					existingNode.serverSpan.end = data;
					existingNode.serverSpan.isActive = false;
				} else {
					existingNode.serverSpan = {
						end: data,
						isActive: false,
					};
					existingNode.isServerSpan = true;
					existingNode.spanId = spanId;
					existingNode.parentSpanId = parentSpanId;
				}

				// If this server span has a parent server span and isn't already a child
				if (
					parentSpanId &&
					spanTree[parentSpanId] &&
					spanTree[parentSpanId].isServerSpan
				) {
					const parentNode = spanTree[parentSpanId];
					// Check if this server span is already a child of the parent
					if (!parentNode.children.some((child) => child.spanId === spanId)) {
						parentNode.children.push(existingNode);
					}
				}
			} else if (spanId) {
				// Store span-end data for later when span-start arrives
				pendingEndEvents.set(spanId, data);
			}
			break;
		}
		case "request": {
			// Handle request events - organize under server spans
			const id = data.id;
			// For requests, the parent is actually data.spanId (the span that contains this request)
			const parentSpanId = data.spanId;

			const node = spanTree[id] || {
				children: [],
				isServerSpan: false,
				spanId: data.spanId,
				parentSpanId,
			};
			node.request = data;
			node.parentSpanId = parentSpanId;
			spanTree[id] = node;

			// If this request has a parent server span, establish hierarchy
			if (
				parentSpanId &&
				spanTree[parentSpanId] &&
				spanTree[parentSpanId].isServerSpan
			) {
				const parentNode = spanTree[parentSpanId];
				// Check if this request node is already a child of the parent
				if (!parentNode.children.some((child) => child.request?.id === id)) {
					parentNode.children.push(node);
				}
			}
			break;
		}
		case "response":
			{
				// Handle response events
				const id = data.id;
				// For responses, the parent is also data.spanId (same as request)
				const parentSpanId = data.spanId;
				const node = spanTree[id] || {
					children: [],
					isServerSpan: false,
					spanId: data.spanId,
					parentSpanId,
				};
				node.response = data;
				node.parentSpanId = parentSpanId;
				spanTree[id] = node;

				// If this response has a parent server span, ensure it's in the hierarchy
				if (
					parentSpanId &&
					spanTree[parentSpanId] &&
					spanTree[parentSpanId].isServerSpan
				) {
					const parentNode = spanTree[parentSpanId];
					const existingChild = parentNode.children.find(
						(child) => child.request?.id === id,
					);

					// If no child with matching request ID found, look for any child with same spanId that has a request but no response
					const availableChild = !existingChild
						? parentNode.children.find(
								(child) =>
									child.spanId === node.spanId &&
									child.request &&
									!child.response,
							)
						: null;

					const targetChild = existingChild || availableChild;

					// Check if this response node is already a child of the parent
					if (targetChild) {
						targetChild.response = data;
					} else {
						parentNode.children.push(node);
					}
				}
			}
			break;
		case "catch-up":
			spanTree = data.reduce(
				(prevTree, event) => mapServerEventToSpanTree(event, prevTree),
				spanTree,
			);
			break;
		default:
			assertType<never>(type);
	}

	return spanTree;
};

export const filterEmptySpans = (spanTree: SpanTree): SpanTree => {
	const filtered: SpanTree = {};
	const filterChildren = (children: SpanNode[]): SpanNode[] => {
		return children
			.filter(
				(child) => child.children.length > 0 || child.request || child.response,
			)
			.map((child) => {
				child.children = filterChildren(child.children);
				return child;
			});
	};

	for (const [id, node] of Object.entries(spanTree)) {
		if (node.children.length > 0 || node.request || node.response) {
			node.children = filterChildren(node.children);
			filtered[id] = node;
		}
	}

	return filtered;
};
