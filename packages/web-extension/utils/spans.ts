import type {
	RequestSpan,
	ResponseSpan,
	ServerEvent,
	Span,
} from "@/packages/types";
import { assertType } from "./type";

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

/**
 * Builds and maintains a hierarchical tree of spans based on server events.
 *
 * This function processes different types of server events (span-start, span-end, request, response, catch-up)
 * and organizes them into a tree structure where:
 * - Server spans (span-start/span-end events) form the hierarchical backbone
 * - Request/response pairs are organized under their corresponding server spans
 * - Parent-child relationships between spans are established based on spanId/parentSpanId correlations
 * - Pending events are handled when span-end events arrive before span-start events
 *
 * The tree structure allows for visualizing the complete request flow, showing how client-side requests
 * trigger server-side operations and their resulting network activity in a hierarchical format.
 *
 * @param event - The server event to process (span-start, span-end, request, response, or catch-up)
 * @param spanTree - The current state of the span tree to update
 * @returns Updated span tree with the new event incorporated
 */
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
				if (parentSpanId && spanTree[parentSpanId]?.isServerSpan) {
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
				if (parentSpanId && spanTree[parentSpanId]?.isServerSpan) {
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
			if (parentSpanId && spanTree[parentSpanId]?.isServerSpan) {
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
				if (parentSpanId && spanTree[parentSpanId]?.isServerSpan) {
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
			// During catch-up, process an array of events to rebuild the span tree
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

export const filterSpansWithoutChildren = (spanTree: SpanTree): SpanTree => {
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

/**
 * Filters a span tree to remove intermediate server spans, keeping only top-level ancestors
 * and their direct leaf children (nodes with requests/responses).
 *
 * This function simplifies the span tree structure by:
 * 1. Identifying leaf nodes (nodes with requests/responses or no children)
 * 2. Finding the top-most non-server ancestor for each leaf
 * 3. Creating a flattened tree where top ancestors point directly to their leaves
 * 4. Preserving standalone nodes that don't have a top ancestor
 *
 * @param spanTree - The original span tree to filter
 * @returns A filtered span tree with intermediate spans removed
 */
export const filterInBetweenSpans = (spanTree: SpanTree): SpanTree => {
	// Input validation
	if (!spanTree || typeof spanTree !== "object") {
		console.warn("filterInBetweenSpans: Invalid spanTree provided");
		return {};
	}

	const filtered: SpanTree = {};

	// Helper function to find all leaf nodes (nodes with request/response or no children)
	const findLeafNodes = (node: SpanNode): SpanNode[] => {
		// If this node has request/response, it's a leaf
		if (node.request || node.response) {
			return [node];
		}

		// If no children, it's a leaf
		if (node.children.length === 0) {
			return [node];
		}

		// Otherwise, recursively collect leaves from children
		return node.children.flatMap((child) => findLeafNodes(child));
	};

	// Find all leaf nodes in the tree
	const allLeaves: SpanNode[] = Object.values(spanTree).flatMap((node) =>
		findLeafNodes(node),
	);

	// For each leaf, find its top-most ancestor (the ancestor that has no parent or parent not in tree)
	const getTopAncestor = (node: SpanNode): SpanNode | null => {
		if (!node.parentSpanId) {
			return node;
		}

		const parent = Object.values(spanTree).find(
			(n) => n.spanId === node.parentSpanId,
		);

		if (!parent) {
			return node;
		}

		// If parent is a server span, skip it and go to its parent
		if (parent.isServerSpan) {
			return getTopAncestor(parent);
		}

		return parent;
	};

	// Create a map from top ancestor to its direct leaf children
	const topAncestorToLeaves = new Map<string, Set<SpanNode>>();

	for (const leaf of allLeaves) {
		const topAncestor = getTopAncestor(leaf);
		if (topAncestor?.spanId) {
			if (!topAncestorToLeaves.has(topAncestor.spanId)) {
				topAncestorToLeaves.set(topAncestor.spanId, new Set<SpanNode>());
			}
			// Use Set to automatically handle duplicates
			// biome-ignore lint/style/noNonNullAssertion: set is initialized above
			topAncestorToLeaves.get(topAncestor.spanId)!.add(leaf);
		}
	}

	// Build the filtered tree with top ancestors pointing directly to their leaf children
	for (const [topAncestorId, leavesSet] of topAncestorToLeaves) {
		const originalNode = spanTree[topAncestorId];
		if (!originalNode) continue;

		const leaves = Array.from(leavesSet);

		// Create a copy with only the leaf children
		const filteredNode: SpanNode = {
			...originalNode,
			children: leaves.map((leaf) => ({
				...leaf,
				parentSpanId: topAncestorId,
			})),
		};

		filtered[topAncestorId] = filteredNode;

		// Also add all leaf nodes directly to the root for quick access
		for (const leaf of leaves) {
			const id = leaf.request?.id;
			if (id && !filtered[id]) {
				const originalLeafNode = spanTree[id];
				if (originalLeafNode) {
					filtered[id] = {
						...originalLeafNode,
						parentSpanId: topAncestorId,
						children: [],
					};
				}
			}
		}
	}

	// Also include any leaf nodes that don't have a top ancestor (standalone nodes)
	for (const leaf of allLeaves) {
		if (!leaf.spanId) continue;

		const topAncestor = getTopAncestor(leaf);
		if ((!topAncestor || topAncestor === leaf) && !filtered[leaf.spanId]) {
			const originalNode = spanTree[leaf.spanId];
			if (originalNode) {
				filtered[leaf.spanId] = {
					...originalNode,
					children: [],
				};
			}
		}
	}

	return filtered;
};

export const filterServerSpans = (spanTree: SpanTree): SpanTree => {
	return Object.fromEntries(
		Object.entries(spanTree).filter(([, value]) => {
			return !value.isServerSpan;
		}),
	);
};

/**
 * Filter spans by URL while preserving parent-child relationships.
 *
 * This function creates a filtered view of the span tree that includes:
 * 1. All nodes matching the URL filter
 * 2. All ancestors of matching nodes (to maintain tree structure)
 * 3. All intermediate nodes needed to connect matching nodes
 *
 * @param spanTree The original span tree
 * @param urlFilter The URL filter string to match against
 * @returns A filtered span tree that preserves parent-child relationships
 */
export const filterSpansByUrl = (
	spanTree: SpanTree,
	urlFilter: string,
): SpanTree => {
	// Input validation
	if (!spanTree || typeof spanTree !== "object") {
		console.warn("filterSpansByUrl: Invalid spanTree provided");
		return {};
	}

	if (!urlFilter || typeof urlFilter !== "string") {
		return spanTree;
	}

	const filterLower = urlFilter.toLowerCase().trim();

	// Early return for empty filter after trimming
	if (!filterLower) {
		return spanTree;
	}

	// Helper function to check if a node matches the URL filter
	const nodeMatchesFilter = (node: SpanNode): boolean => {
		return !!(
			node.serverSpan?.start?.id.toLowerCase().includes(filterLower) ||
			node.request?.url?.toLowerCase().includes(filterLower) ||
			node.children.some(
				(child) =>
					child.serverSpan?.start?.id.toLowerCase().includes(filterLower) ||
					child.request?.url?.toLowerCase().includes(filterLower),
			)
		);
	};

	// Helper function to get all ancestors of a node
	const getAncestorIds = (
		nodeId: string,
		ancestors: Set<string> = new Set(),
	): Set<string> => {
		const node = spanTree[nodeId];
		if (!node?.parentSpanId) {
			return ancestors;
		}

		ancestors.add(node.parentSpanId);
		return getAncestorIds(node.parentSpanId, ancestors);
	};

	// Helper function to build a span ID to node ID mapping for efficient lookups
	const buildSpanIdToNodeIdMap = (): Map<string, string> => {
		const map = new Map<string, string>();
		for (const [nodeId, node] of Object.entries(spanTree)) {
			if (node.spanId) {
				map.set(node.spanId, nodeId);
			}
		}
		return map;
	};

	// Step 1: Find all nodes that match the URL filter
	const matchingNodeIds = new Set<string>();
	for (const [id, node] of Object.entries(spanTree)) {
		if (nodeMatchesFilter(node)) {
			matchingNodeIds.add(id);
		}
	}

	// If no matches found, return empty span tree
	if (matchingNodeIds.size === 0) {
		return {};
	}

	// Step 2: Collect all nodes to include (matching nodes + their ancestors)
	const nodesToInclude = new Set<string>();

	// Add matching nodes and their ancestors
	for (const matchingId of matchingNodeIds) {
		nodesToInclude.add(matchingId);
		const ancestors = getAncestorIds(matchingId);
		ancestors.forEach((ancestorId) => nodesToInclude.add(ancestorId));
	}

	// Step 3: Add intermediate nodes needed to connect the tree structure
	const spanIdToNodeIdMap = buildSpanIdToNodeIdMap();
	let changed = true;

	// Iteratively add parent nodes that have children in the included set
	// This ensures we maintain tree connectivity
	while (changed) {
		changed = false;

		for (const [nodeId, node] of Object.entries(spanTree)) {
			// Skip if already included
			if (nodesToInclude.has(nodeId)) {
				continue;
			}

			// Check if this node has any children that are included
			const hasIncludedChild = node.children.some((child) => {
				if (!child.spanId) return false;
				const childNodeId = spanIdToNodeIdMap.get(child.spanId);
				return childNodeId && nodesToInclude.has(childNodeId);
			});

			if (hasIncludedChild) {
				nodesToInclude.add(nodeId);
				changed = true;
			}
		}
	}

	// Step 4: Build the filtered tree with only included nodes
	const filtered: SpanTree = {};

	for (const nodeId of nodesToInclude) {
		const originalNode = spanTree[nodeId];
		if (!originalNode) continue;

		// Create a copy of the node with filtered children
		const nodeCopy: SpanNode = {
			...originalNode,
			children: [],
		};

		// Only include children that are also in the nodesToInclude set
		for (const child of originalNode.children) {
			if (!child.spanId) continue;

			const childNodeId = spanIdToNodeIdMap.get(child.spanId);
			if (childNodeId && nodesToInclude.has(childNodeId)) {
				nodeCopy.children.push(spanTree[childNodeId]);
			}
		}

		filtered[nodeId] = nodeCopy;
	}

	return filtered;
};
