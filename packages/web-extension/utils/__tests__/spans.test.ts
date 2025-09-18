import { describe, expect, it } from "vitest";
import type {
	RequestSpan,
	ResponseSpan,
	ServerEvent,
	Span,
} from "@/packages/types";
import {
	filterInBetweenSpans,
	filterServerSpans,
	filterSpansWithoutChildren,
	mapServerEventToSpanTree,
	type SpanNode,
	type SpanTree,
} from "../spans";

// Helper function to create mock span data
const createMockSpan = (overrides: Partial<Span> = {}): Span => ({
	id: "span-1",
	start: 1000,
	end: 2000,
	spanId: "span-1",
	traceId: "trace-1",
	parentSpan: undefined,
	...overrides,
});

// Helper function to create mock request data
const createMockRequest = (
	overrides: Partial<RequestSpan> = {},
): RequestSpan => ({
	id: "req-1",
	start: 1000,
	end: 2000,
	spanId: "span-1",
	traceId: "trace-1",
	parentSpan: undefined,
	method: "GET",
	url: "https://api.example.com/users",
	headers: { "Content-Type": "application/json" },
	body: undefined,
	...overrides,
});

// Helper function to create mock response data
const createMockResponse = (
	overrides: Partial<ResponseSpan> = {},
): ResponseSpan => ({
	id: "req-1",
	start: 1000,
	end: 2000,
	spanId: "span-1",
	traceId: "trace-1",
	parentSpan: undefined,
	status: 200,
	statusText: "OK",
	headers: { "Content-Type": "application/json" },
	body: '{"users": []}',
	...overrides,
});

describe("mapServerEventToSpanTree", () => {
	describe("Basic Operations", () => {
		it("adds a span-start event to an empty tree", () => {
			const spanData = createMockSpan();
			const event: ServerEvent = { type: "span-start", data: spanData };

			const result = mapServerEventToSpanTree(event, {});

			expect(result["span-1"]).toBeDefined();
			expect(result["span-1"].isServerSpan).toBe(true);
			expect(result["span-1"].serverSpan?.start).toBe(spanData);
			expect(result["span-1"].serverSpan?.isActive).toBe(true);
			expect(result["span-1"].children).toEqual([]);
		});

		it("does not add a span-end event to an empty tree", () => {
			const spanData = createMockSpan();
			const event: ServerEvent = { type: "span-end", data: spanData };

			const result = mapServerEventToSpanTree(event, {});

			// span-end to empty tree doesn't create a new node - it only updates existing ones
			expect(Object.keys(result)).toHaveLength(0);
		});

		it("adds a request to an empty tree", () => {
			const requestData = createMockRequest();
			const event: ServerEvent = { type: "request", data: requestData };

			const result = mapServerEventToSpanTree(event, {});

			expect(result["req-1"]).toBeDefined();
			expect(result["req-1"].isServerSpan).toBe(false);
			expect(result["req-1"].request).toBe(requestData);
			expect(result["req-1"].children).toEqual([]);
		});

		it("adds a response to an empty tree", () => {
			const responseData = createMockResponse();
			const event: ServerEvent = { type: "response", data: responseData };

			const result = mapServerEventToSpanTree(event, {});

			expect(result["req-1"]).toBeDefined();
			expect(result["req-1"].isServerSpan).toBe(false);
			expect(result["req-1"].response).toBe(responseData);
			expect(result["req-1"].children).toEqual([]);
		});
	});

	describe("Span Lifecycle", () => {
		it("completes a span lifecycle (start -> end)", () => {
			const spanData = createMockSpan();
			const startEvent: ServerEvent = { type: "span-start", data: spanData };
			const endEvent: ServerEvent = {
				type: "span-end",
				data: { ...spanData, end: 3000 },
			};

			let result = mapServerEventToSpanTree(startEvent, {});
			result = mapServerEventToSpanTree(endEvent, result);

			const node = result["span-1"];
			expect(node.serverSpan?.start).toBe(spanData);
			expect(node.serverSpan?.end?.end).toBe(3000);
			expect(node.serverSpan?.isActive).toBe(false);
		});

		it("handles span-end before span-start", () => {
			const spanData = createMockSpan();
			const endEvent: ServerEvent = { type: "span-end", data: spanData };
			const startEvent: ServerEvent = { type: "span-start", data: spanData };

			let result = mapServerEventToSpanTree(endEvent, {});
			// span-end to empty tree doesn't create a node
			expect(Object.keys(result)).toHaveLength(0);

			result = mapServerEventToSpanTree(startEvent, result);

			const node = result["span-1"];
			expect(node.serverSpan?.start).toBe(spanData);
			expect(node.serverSpan?.end).toBe(spanData); // Should have the end data from the earlier event
			expect(node.serverSpan?.isActive).toBe(false); // Should be inactive since it has end data
		});
	});

	describe("Request-Response Pairing", () => {
		it("pairs request and response with same id", () => {
			const requestData = createMockRequest();
			const responseData = createMockResponse();
			const requestEvent: ServerEvent = {
				type: "request",
				data: requestData,
			};
			const responseEvent: ServerEvent = {
				type: "response",
				data: responseData,
			};

			let result = mapServerEventToSpanTree(requestEvent, {});
			result = mapServerEventToSpanTree(responseEvent, result);

			const node = result["req-1"];
			expect(node.request).toBe(requestData);
			expect(node.response).toBe(responseData);
			expect(Object.keys(result)).toHaveLength(1);
		});

		it("handles response before request", () => {
			const requestData = createMockRequest();
			const responseData = createMockResponse();
			const requestEvent: ServerEvent = {
				type: "request",
				data: requestData,
			};
			const responseEvent: ServerEvent = {
				type: "response",
				data: responseData,
			};

			let result = mapServerEventToSpanTree(responseEvent, {});
			result = mapServerEventToSpanTree(requestEvent, result);

			const node = result["req-1"];
			expect(node.request).toBe(requestData);
			expect(node.response).toBe(responseData);
			expect(Object.keys(result)).toHaveLength(1);
		});
	});

	describe("Parent-Child Relationships", () => {
		it("establishes parent-child relationship for server spans", () => {
			const parentSpan = createMockSpan({
				spanId: "parent-span",
				id: "parent-span",
			});
			const childSpan = createMockSpan({
				spanId: "child-span",
				id: "child-span",
				parentSpan: { spanId: "parent-span", traceId: "trace-1" },
			});

			const parentEvent: ServerEvent = {
				type: "span-start",
				data: parentSpan,
			};
			const childEvent: ServerEvent = { type: "span-start", data: childSpan };

			let result = mapServerEventToSpanTree(parentEvent, {});
			result = mapServerEventToSpanTree(childEvent, result);

			expect(result["parent-span"].children).toHaveLength(1);
			expect(result["parent-span"].children[0].spanId).toBe("child-span");
			expect(result["child-span"].parentSpanId).toBe("parent-span");
		});

		it("establishes parent-child relationship when child comes before parent", () => {
			const parentSpan = createMockSpan({
				spanId: "parent-span",
				id: "parent-span",
			});
			const childSpan = createMockSpan({
				spanId: "child-span",
				id: "child-span",
				parentSpan: { spanId: "parent-span", traceId: "trace-1" },
			});

			const childEvent: ServerEvent = { type: "span-start", data: childSpan };
			const parentEvent: ServerEvent = {
				type: "span-start",
				data: parentSpan,
			};

			let result = mapServerEventToSpanTree(childEvent, {});
			result = mapServerEventToSpanTree(parentEvent, result);

			expect(result["parent-span"].children).toHaveLength(1);
			expect(result["parent-span"].children[0].spanId).toBe("child-span");
		});

		it("attaches request to parent server span", () => {
			const serverSpan = createMockSpan({
				spanId: "server-span",
				id: "server-span",
			});
			const request = createMockRequest({
				id: "req-1",
				spanId: "server-span",
			});

			const spanEvent: ServerEvent = { type: "span-start", data: serverSpan };
			const requestEvent: ServerEvent = { type: "request", data: request };

			let result = mapServerEventToSpanTree(spanEvent, {});
			result = mapServerEventToSpanTree(requestEvent, result);

			expect(result["server-span"].children).toHaveLength(1);
			expect(result["server-span"].children[0].request?.id).toBe("req-1");
		});

		it("attaches response to parent server span", () => {
			const serverSpan = createMockSpan({
				spanId: "server-span",
				id: "server-span",
			});
			const response = createMockResponse({
				id: "resp-1",
				spanId: "server-span",
			});

			const spanEvent: ServerEvent = { type: "span-start", data: serverSpan };
			const responseEvent: ServerEvent = { type: "response", data: response };

			let result = mapServerEventToSpanTree(spanEvent, {});
			result = mapServerEventToSpanTree(responseEvent, result);

			expect(result["server-span"].children).toHaveLength(1);
			expect(result["server-span"].children[0].response?.id).toBe("resp-1");
		});

		it("attaches response to parent server span with existing request", () => {
			const serverSpan = createMockSpan({
				spanId: "server-span",
				id: "server-span",
			});
			const request = createMockRequest({
				spanId: "server-span",
			});
			const response = createMockResponse({
				id: "resp-1",
				spanId: "server-span",
			});

			const spanEvent: ServerEvent = {
				type: "span-start",
				data: serverSpan,
			};
			const requestEvent: ServerEvent = {
				type: "request",
				data: request,
			};
			const responseEvent: ServerEvent = {
				type: "response",
				data: response,
			};

			let result = mapServerEventToSpanTree(spanEvent, {});
			result = mapServerEventToSpanTree(requestEvent, result);
			result = mapServerEventToSpanTree(responseEvent, result);

			expect(result["server-span"].children).toHaveLength(1);
			expect(result["server-span"].children[0].response?.id).toBe("resp-1");
		});

		it("attaches new request to a span with existing request-response", () => {
			const serverSpan = createMockSpan({
				spanId: "server-span",
				id: "server-span",
			});
			const request = createMockRequest({
				id: "req-1",
				spanId: "server-span",
			});
			const response = createMockResponse({
				id: "resp-1",
				spanId: "server-span",
			});
			const newRequest = createMockRequest({
				id: "req-2",
				spanId: "server-span",
			});

			const spanEvent: ServerEvent = {
				type: "span-start",
				data: serverSpan,
			};
			const requestEvent: ServerEvent = {
				type: "request",
				data: request,
			};
			const responseEvent: ServerEvent = {
				type: "response",
				data: response,
			};
			const newRequestEvent: ServerEvent = {
				type: "request",
				data: newRequest,
			};

			let result = mapServerEventToSpanTree(spanEvent, {});
			result = mapServerEventToSpanTree(requestEvent, result);
			result = mapServerEventToSpanTree(responseEvent, result);
			result = mapServerEventToSpanTree(newRequestEvent, result);

			expect(result["server-span"].children).toHaveLength(2);
		});
	});

	describe("Multi-Level Hierarchies", () => {
		it("creates three-level hierarchy", () => {
			const rootSpan = createMockSpan({ spanId: "root", id: "root" });
			const middleSpan = createMockSpan({
				spanId: "middle",
				id: "middle",
				parentSpan: { spanId: "root", traceId: "trace-1" },
			});
			const leafSpan = createMockSpan({
				spanId: "leaf",
				id: "leaf",
				parentSpan: { spanId: "middle", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: rootSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: middleSpan },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: leafSpan },
				result,
			);

			expect(result["root"].children).toHaveLength(1);
			expect(result["middle"].children).toHaveLength(1);
			expect(result["leaf"].children).toHaveLength(0);

			expect(result["root"].children[0].spanId).toBe("middle");
			expect(result["middle"].children[0].spanId).toBe("leaf");
		});

		it("handles multiple siblings", () => {
			const parentSpan = createMockSpan({ spanId: "parent", id: "parent" });
			const child1 = createMockSpan({
				spanId: "child1",
				id: "child1",
				parentSpan: { spanId: "parent", traceId: "trace-1" },
			});
			const child2 = createMockSpan({
				spanId: "child2",
				id: "child2",
				parentSpan: { spanId: "parent", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: parentSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: child1 },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: child2 },
				result,
			);

			expect(result["parent"].children).toHaveLength(2);
			const childIds = result["parent"].children.map((c) => c.spanId);
			expect(childIds).toContain("child1");
			expect(childIds).toContain("child2");
		});
	});

	describe("Edge Cases", () => {
		it("handles missing spanId gracefully", () => {
			const spanData = createMockSpan({ spanId: undefined });
			const event: ServerEvent = { type: "span-start", data: spanData };

			const result = mapServerEventToSpanTree(event, {});

			expect(Object.keys(result)).toHaveLength(0);
		});

		it("handles orphaned spans (parent doesn't exist)", () => {
			const orphanSpan = createMockSpan({
				spanId: "orphan",
				id: "orphan",
				parentSpan: { spanId: "nonexistent", traceId: "trace-1" },
			});

			const result = mapServerEventToSpanTree(
				{ type: "span-start", data: orphanSpan },
				{},
			);

			expect(result["orphan"]).toBeDefined();
			expect(result["orphan"].parentSpanId).toBe("nonexistent");
			expect(result["orphan"].children).toEqual([]);
		});

		it("prevents duplicate children", () => {
			const parentSpan = createMockSpan({ spanId: "parent", id: "parent" });
			const childSpan = createMockSpan({
				spanId: "child",
				id: "child",
				parentSpan: { spanId: "parent", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: parentSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: childSpan },
				result,
			);
			// Add same child again
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: childSpan },
				result,
			);

			expect(result["parent"].children).toHaveLength(1);
		});

		it("handles span-end for nonexistent span", () => {
			const spanData = createMockSpan({ spanId: "nonexistent" });
			const event: ServerEvent = { type: "span-end", data: spanData };

			const result = mapServerEventToSpanTree(event, {});

			expect(Object.keys(result)).toHaveLength(0);
		});

		it("handles request with missing parent span", () => {
			const request = createMockRequest({
				spanId: "nonexistent-parent",
			});

			const result = mapServerEventToSpanTree(
				{ type: "request", data: request },
				{},
			);

			expect(result["req-1"]).toBeDefined();
			expect(result["req-1"].parentSpanId).toBe("nonexistent-parent");
		});

		it("handles request without spanId", () => {
			const request = createMockRequest({ spanId: undefined });

			const result = mapServerEventToSpanTree(
				{ type: "request", data: request },
				{},
			);

			expect(result["req-1"]).toBeDefined();
			expect(result["req-1"].parentSpanId).toBeUndefined();
		});
	});

	describe("State Management", () => {
		it("preserves existing tree when adding new nodes", () => {
			const existingSpan = createMockSpan({
				spanId: "existing",
				id: "existing",
			});
			const newSpan = createMockSpan({ spanId: "new", id: "new" });

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: existingSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: newSpan },
				result,
			);

			expect(Object.keys(result)).toHaveLength(2);
			expect(result["existing"]).toBeDefined();
			expect(result["new"]).toBeDefined();
		});

		it("updates existing node without losing children", () => {
			const parentSpan = createMockSpan({ spanId: "parent", id: "parent" });
			const childSpan = createMockSpan({
				spanId: "child",
				id: "child",
				parentSpan: { spanId: "parent", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: parentSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: childSpan },
				result,
			);

			// End the parent span - should preserve children
			const endParent = { ...parentSpan, end: 3000 };
			result = mapServerEventToSpanTree(
				{ type: "span-end", data: endParent },
				result,
			);

			expect(result["parent"].children).toHaveLength(1);
			expect(result["parent"].serverSpan?.end).toBeDefined();
		});
	});

	describe("Complex Integration Scenarios", () => {
		it("handles complete request flow with nested spans", () => {
			// Root server span
			const rootSpan = createMockSpan({ spanId: "root", id: "root" });

			// Child server span
			const childSpan = createMockSpan({
				spanId: "child",
				id: "child",
				parentSpan: { spanId: "root", traceId: "trace-1" },
			});

			// Request within child span
			const request = createMockRequest({
				id: "api-call",
				spanId: "child",
			});

			// Response for the request
			const response = createMockResponse({
				id: "api-call",
				spanId: "child",
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: rootSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: childSpan },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "request", data: request },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "response", data: response },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "span-end", data: childSpan },
				result,
			);
			result = mapServerEventToSpanTree(
				{ type: "span-end", data: rootSpan },
				result,
			);

			// Validate structure
			expect(result["root"].children).toHaveLength(1);
			expect(result["child"].children).toHaveLength(1);
			expect(result["root"].children[0].children).toHaveLength(1);

			const requestNode = result["child"].children[0];
			expect(requestNode.request?.id).toBe("api-call");
			expect(requestNode.response?.id).toBe("api-call");

			// Validate span states
			expect(result["root"].serverSpan?.isActive).toBe(false);
			expect(result["child"].serverSpan?.isActive).toBe(false);
		});

		it("handles mixed event ordering", () => {
			const events: ServerEvent[] = [
				{
					type: "request",
					data: createMockRequest({ id: "req1", spanId: "span1" }),
				},
				{
					type: "span-end",
					data: createMockSpan({ spanId: "span2", id: "span2" }),
				},
				{
					type: "span-start",
					data: createMockSpan({ spanId: "span1", id: "span1" }),
				},
				{
					type: "response",
					data: createMockResponse({ id: "req1", spanId: "span1" }),
				},
				{
					type: "span-start",
					data: createMockSpan({
						spanId: "span2",
						id: "span2",
						parentSpan: { spanId: "span1", traceId: "trace-1" },
					}),
				},
				{
					type: "span-end",
					data: createMockSpan({ spanId: "span1", id: "span1" }),
				},
			];

			let result: SpanTree = {};
			events.forEach((event) => {
				result = mapServerEventToSpanTree(event, result);
			});

			// Validate final structure
			expect(result["span1"].children).toHaveLength(2); // span2 and req1
			expect(result["span1"].serverSpan?.isActive).toBe(false);
			expect(result["span2"].serverSpan?.isActive).toBe(false);

			const requestNode = result["span1"].children.find(
				(c) => c.request?.id === "req1",
			);
			expect(requestNode?.request).toBeDefined();
			expect(requestNode?.response).toBeDefined();
		});
	});

	describe("Tree Structure Validation", () => {
		it("maintains consistent spanId and parentSpanId references", () => {
			const parentSpan = createMockSpan({ spanId: "parent", id: "parent" });
			const childSpan = createMockSpan({
				spanId: "child",
				id: "child",
				parentSpan: { spanId: "parent", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: parentSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: childSpan },
				result,
			);

			expect(result["parent"].spanId).toBe("parent");
			expect(result["parent"].parentSpanId).toBeUndefined();
			expect(result["child"].spanId).toBe("child");
			expect(result["child"].parentSpanId).toBe("parent");
		});

		it("maintains isServerSpan flags correctly", () => {
			const serverSpan = createMockSpan({ spanId: "server", id: "server" });
			const request = createMockRequest({ id: "req", spanId: "server" });

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: serverSpan },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "request", data: request },
				result,
			);

			expect(result["server"].isServerSpan).toBe(true);
			expect(result["req"].isServerSpan).toBe(false);
		});

		it("prevents circular references", () => {
			// This test ensures the function doesn't create infinite loops
			const span1 = createMockSpan({
				spanId: "span1",
				id: "span1",
				parentSpan: { spanId: "span2", traceId: "trace-1" },
			});
			const span2 = createMockSpan({
				spanId: "span2",
				id: "span2",
				parentSpan: { spanId: "span1", traceId: "trace-1" },
			});

			let result = mapServerEventToSpanTree(
				{ type: "span-start", data: span1 },
				{},
			);
			result = mapServerEventToSpanTree(
				{ type: "span-start", data: span2 },
				result,
			);

			// Should not create infinite loops - each span should only appear once in the tree
			expect(Object.keys(result)).toHaveLength(2);
			expect(result["span1"].parentSpanId).toBe("span2");
			expect(result["span2"].parentSpanId).toBe("span1");
		});
	});
});

describe("filterEmptySpans", () => {
	it("only returns spans that have children and/or request/responses defined", () => {
		const request = createMockRequest();
		const response = createMockResponse();
		const requestResponseSpan: SpanNode = {
			spanId: "request_response_span",
			isServerSpan: false,
			children: [],
			request,
			response,
		};
		const emptySpan: SpanNode = {
			spanId: "empty_span",
			isServerSpan: false,
			children: [],
		};
		const spanWithChildren = {
			spanId: "span_with_children",
			isServerSpan: false,
			children: [requestResponseSpan, emptySpan],
		};

		expect(
			filterSpansWithoutChildren({
				requestResponseSpan,
				emptySpan,
				spanWithChildren,
			}),
		).toEqual({
			requestResponseSpan,
			spanWithChildren: {
				...spanWithChildren,
				children: [requestResponseSpan],
			},
		});
	});
});

describe("filterInBetweenChildren", () => {
	it("should remove the in-between nodes and return top spans with bottommost children", () => {
		const rootSpan = createMockSpan({ spanId: "root", id: "root" });

		// An in-between span that should be removed
		const inBetweenSpan = createMockSpan({
			spanId: "in-between-span",
			id: "in-between-span",
			parentSpan: { spanId: rootSpan.id, traceId: "trace-1" },
		});

		const childSpan = createMockSpan({
			spanId: "child",
			id: "child",
			parentSpan: { spanId: inBetweenSpan.id, traceId: "trace-1" },
		});

		// Request within child span
		const request = createMockRequest({
			id: "api-call",
			spanId: "child",
		});

		// Response for the request
		const response = createMockResponse({
			id: "api-call",
			spanId: "child",
		});

		let result = mapServerEventToSpanTree(
			{ type: "span-start", data: rootSpan },
			{},
		);
		result = mapServerEventToSpanTree(
			{ type: "span-start", data: inBetweenSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-start", data: childSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "request", data: request },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "response", data: response },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-end", data: childSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-end", data: inBetweenSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-end", data: rootSpan },
			result,
		);

		const filteredTree = filterInBetweenSpans(result);

		// Checking if root's child is now the child span
		expect(filteredTree["root"].children[0].spanId).toEqual(childSpan.id);
		expect(filteredTree["root"].children[0].children.length).toBe(0);
	});
});

describe("filterServerSpans", () => {
	it("removes all server spans from the tree leaving only the ones with requests", () => {
		const rootSpan = createMockSpan({ spanId: "root", id: "root" });

		const childSpan = createMockSpan({
			spanId: "child",
			id: "child",
			parentSpan: { spanId: "root", traceId: "trace-1" },
		});

		// Request within child span
		const request = createMockRequest({
			id: "api-call",
			spanId: "child",
		});

		// Response for the request
		const response = createMockResponse({
			id: "api-call",
			spanId: "child",
		});

		let result = mapServerEventToSpanTree(
			{ type: "span-start", data: rootSpan },
			{},
		);
		result = mapServerEventToSpanTree(
			{ type: "span-start", data: childSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "request", data: request },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "response", data: response },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-end", data: childSpan },
			result,
		);
		result = mapServerEventToSpanTree(
			{ type: "span-end", data: rootSpan },
			result,
		);

		const filteredTree = filterServerSpans(result);

		expect(filteredTree["root"]).toBeUndefined();
		expect(filteredTree["child"]).toBeUndefined();
		expect(filteredTree[request.id]).not.toBeUndefined();
	});
});
