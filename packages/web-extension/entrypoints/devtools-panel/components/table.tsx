import { useCallback, useMemo, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan, Span } from "@/packages/types";
import type { SpanTree } from "../../../utils/spans";
import { cn } from "../../../utils/style";
import { formatDuration } from "../../../utils/time";

type SpanNode = {
	// Server span data (from span-start/span-end events)
	serverSpan?: {
		start?: Span;
		end?: Span;
		isActive: boolean;
	};
	// Request/response data (existing)
	request?: RequestSpan;
	response?: ResponseSpan;
	// Hierarchical structure
	children: SpanNode[];
	// Metadata for organization
	spanId?: string;
	parentSpanId?: string;
	isServerSpan: boolean;
};

export interface HttpRequestData {
	id: string;
	parentSpanId?: string;
	status?: number;
	method: string;
	url: string;
	duration?: number;
	timestamp: number;
	request?: RequestSpan;
	response?: ResponseSpan;
	level: number;
	isGrouped: boolean;
	groupId?: string;
	children?: HttpRequestData[];
}

export type SortColumn = "status" | "method" | "url" | "duration";
export type SortDirection = "asc" | "desc";

export interface TableProps {
	data: HttpRequestData[];
	loading?: boolean;
	error?: string;
	onRowClick?: (request: HttpRequestData) => void;
	virtualScrolling?: boolean;
	className?: string;
}

interface SortState {
	column: SortColumn | null;
	direction: SortDirection;
}

interface GroupState {
	[groupId: string]: boolean;
}

const ITEM_HEIGHT = 48;
const VIEWPORT_HEIGHT = 400;

export function transformSpanTreeToTableData(
	spanTree: SpanTree,
): HttpRequestData[] {
	const result: HttpRequestData[] = [];

	function processNode(
		node: SpanNode,
		level: number = 0,
		parentId?: string,
	): void {
		// Process server spans as organizational units
		if (node.isServerSpan && node.serverSpan) {
			// Extract span attributes for better display
			const spanStart = node.serverSpan.start;
			const spanEnd = node.serverSpan.end;

			// Calculate accurate timing from OpenTelemetry span data
			const startTime = spanStart?.start || 0;
			const endTime = spanEnd?.end || spanStart?.end || 0;
			const duration = endTime > startTime ? endTime - startTime : undefined;

			// Create a meaningful display name from span attributes
			const displayName =
				spanStart?.id || `Server Span ${node.spanId || "Unknown"}`;

			const serverSpanData: HttpRequestData = {
				id: node.spanId || `server-${Date.now()}-${Math.random()}`,
				parentSpanId: parentId,
				status: undefined, // Server spans don't have HTTP status
				method: "",
				url: displayName,
				duration,
				timestamp: startTime,
				request: undefined, // Server spans don't have request data
				response: undefined,
				level,
				isGrouped: node.children.length > 0,
				groupId: node.children.length > 0 ? node.spanId : undefined,
				children: [],
			};

			result.push(serverSpanData);

			// Process child nodes (requests/responses or nested server spans) under this server span
			if (node.children.length > 0) {
				node.children.forEach((child) => {
					processNode(child, level + 1, node.spanId);
				});
			}
		}
		// Process regular request/response nodes
		else if (node.request) {
			// Calculate accurate duration from request/response timing
			const requestStart = node.request.start || 0;
			const responseEnd = node.response?.end || node.request.end || 0;
			const duration =
				responseEnd > requestStart ? responseEnd - requestStart : undefined;

			// Use the request ID as the primary identifier
			const requestId = node.request.id;

			const requestData: HttpRequestData = {
				id: requestId,
				parentSpanId: parentId,
				status: node.response?.status,
				method: node.request.method,
				url: node.request.url,
				duration,
				timestamp: requestStart,
				request: node.request,
				response: node.response,
				level,
				isGrouped: node.children.length > 0,
				groupId: node.children.length > 0 ? requestId : undefined,
				children: [],
			};

			result.push(requestData);

			// Process child nodes (nested requests or server spans)
			if (node.children.length > 0) {
				node.children.forEach((child) => {
					processNode(child, level + 1, requestId);
				});
			}
		}
		// Handle nodes that might have children but no direct request data
		else if (node.children.length > 0) {
			// Process orphaned children - this handles edge cases where hierarchy exists
			// but the parent node doesn't have complete data
			node.children.forEach((child) => {
				processNode(child, level, parentId);
			});
		}
	}

	// Convert SpanTree (Record) to array of nodes for processing
	const nodes = Object.values(spanTree);

	// Find root nodes (nodes without parents or with parents not in the current tree)
	const rootNodes = nodes.filter((node) => {
		const parentId = node.parentSpanId;
		return !parentId || !spanTree[parentId];
	});

	// Process all root nodes - hierarchy is already built by the spans utility
	rootNodes.forEach((node) => processNode(node));

	// Sort by timestamp to maintain chronological order
	return result.sort((a, b) => a.timestamp - b.timestamp);
}

export function HttpRequestsTable({
	data,
	loading = false,
	error,
	onRowClick,
	virtualScrolling = false,
	className = "",
}: TableProps) {
	const [sortState, setSortState] = useState<SortState>({
		column: null,
		direction: "asc",
	});
	const [groupState, setGroupState] = useState<GroupState>({});
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const tableRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);

	const truncateUrl = (url: string, maxLength = 50) => {
		if (url.length <= maxLength) return url;
		const start = url.substring(0, maxLength / 2 - 3);
		const end = url.substring(url.length - maxLength / 2 + 3);
		return `${start}...${end}`;
	};

	const sortData = useCallback(
		(data: HttpRequestData[], column: SortColumn, direction: SortDirection) => {
			return [...data].sort((a, b) => {
				let aVal: string | number;
				let bVal: string | number;

				switch (column) {
					case "status":
						aVal = a.status ?? 0;
						bVal = b.status ?? 0;
						break;
					case "method":
						aVal = a.method;
						bVal = b.method;
						break;
					case "url":
						aVal = a.url;
						bVal = b.url;
						break;
					case "duration":
						aVal = a.duration ?? 0;
						bVal = b.duration ?? 0;
						break;
					default:
						return 0;
				}

				if (aVal < bVal) return direction === "asc" ? -1 : 1;
				if (aVal > bVal) return direction === "asc" ? 1 : -1;
				return 0;
			});
		},
		[],
	);

	const processedData = useMemo(() => {
		let processed = [...data];

		if (sortState.column) {
			processed = sortData(processed, sortState.column, sortState.direction);
		}

		return processed;
		// return processed.filter((item) => {
		// 	if (item.groupId && !groupState[item.groupId]) {
		// 		return false;
		// 	}
		// 	return true;
		// });
	}, [data, sortState, groupState, sortData]);

	const handleSort = (column: SortColumn) => {
		setSortState((prev) => ({
			column,
			direction:
				prev.column === column && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	const handleGroupToggle = (groupId: string) => {
		setGroupState((prev) => ({
			...prev,
			[groupId]: !prev[groupId],
		}));
	};

	const handleRowClick = (
		request: HttpRequestData,
		event: React.MouseEvent<HTMLDivElement>,
	) => {
		event.preventDefault();
		setSelectedRowId(request.id);
		onRowClick?.(request);
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		const currentIndex = processedData.findIndex(
			(item) => item.id === selectedRowId,
		);

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				if (currentIndex < processedData.length - 1) {
					setSelectedRowId(processedData[currentIndex + 1].id);
					onRowClick?.(processedData[currentIndex + 1]);
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (currentIndex > 0) {
					setSelectedRowId(processedData[currentIndex - 1].id);
					onRowClick?.(processedData[currentIndex - 1]);
				}
				break;
		}
	};

	const renderSortIcon = (column: SortColumn) => {
		if (sortState.column !== column) {
			return null;
		}

		return sortState.direction === "asc" ? (
			<span className="text-primary">▲</span>
		) : (
			<span className="text-primary">▼</span>
		);
	};

	const visibleItems = useMemo(() => {
		if (!virtualScrolling) return processedData;

		const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
		const endIndex = Math.min(
			startIndex + Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + 1,
			processedData.length,
		);

		return processedData.slice(startIndex, endIndex).map((item, index) => ({
			...item,
			virtualIndex: startIndex + index,
		}));
	}, [processedData, scrollTop, virtualScrolling]);

	const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(event.currentTarget.scrollTop);
	};

	if (error) {
		return (
			<div className="flex h-full items-center justify-center text-error border-t-2 border-primary">
				<div className="text-center">
					<div className="text-lg font-semibold mb-1">
						Error loading requests
					</div>
					<div className="text-sm text-secondary">{error}</div>
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-tertiary border-t-2 border-primary">
				<div className="text-center">
					<div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
					<div>Loading requests...</div>
				</div>
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-tertiary border-t-2 border-primary">
				<div className="text-center">
					<div className="text-lg font-semibold mb-1">No requests</div>
					<div className="text-sm">
						HTTP requests will appear here when intercepted
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"border-t-2 h-full border-primary overflow-auto",
				className,
			)}
			onKeyDown={handleKeyDown}
			role="table"
			aria-label="HTTP Requests Table"
		>
			{/* Table Header */}
			<div className="border-b border-primary px-4 py-3 sticky top-0 bg-white">
				<div className="grid grid-cols-12 gap-4 text-sm font-medium text-secondary">
					<button
						type="button"
						className="col-span-5 text-left transition-colors flex items-center gap-1"
						onClick={() => handleSort("url")}
					>
						URL {renderSortIcon("url")}
					</button>
					<button
						type="button"
						className="col-span-2 text-left transition-colors flex items-center gap-1"
						onClick={() => handleSort("method")}
					>
						Method {renderSortIcon("method")}
					</button>
					<button
						type="button"
						className="col-span-2 text-left transition-colors flex items-center gap-1"
						onClick={() => handleSort("status")}
					>
						Status {renderSortIcon("status")}
					</button>
					<button
						type="button"
						className="col-span-3 text-left transition-colors flex items-center gap-1"
						onClick={() => handleSort("duration")}
					>
						Duration {renderSortIcon("duration")}
					</button>
				</div>
			</div>

			{/* Table Body */}
			<div
				ref={tableRef}
				style={{ height: virtualScrolling ? `${VIEWPORT_HEIGHT}px` : "auto" }}
				onScroll={virtualScrolling ? handleScroll : undefined}
			>
				{virtualScrolling && (
					<div style={{ height: `${processedData.length * ITEM_HEIGHT}px` }} />
				)}
				<div
					className={virtualScrolling ? "absolute top-0 left-0 right-0" : ""}
					style={
						virtualScrolling
							? {
									transform: `translateY(${Math.floor(scrollTop / ITEM_HEIGHT) * ITEM_HEIGHT}px)`,
								}
							: {}
					}
				>
					{visibleItems.map((request) => (
						<div
							key={request.id}
							className={cn(
								"border-b border-gray-700 px-4 py-3 cursor-pointer transition-colors focus:outline-none",
								selectedRowId === request.id
									? "bg-primary/10 border-primary/50"
									: "",
							)}
							onClick={(e) => handleRowClick(request, e)}
							tabIndex={0}
							style={{
								...(virtualScrolling ? { height: `${ITEM_HEIGHT}px` } : {}),
							}}
						>
							<div className="grid grid-cols-12 gap-4 items-center text-sm">
								{request.method || request.status ? (
									<>
										<div
											className="col-span-5 text-primary truncate"
											style={{
												paddingLeft: `${request.level * 12}px`,
											}}
											title={request.url}
										>
											{request.isGrouped &&
												request.children &&
												request.children.length > 0 && (
													<button
														type="button"
														className="mr-2 text-primary hover:text-primary/80"
														onClick={(e) => {
															e.stopPropagation();
															if (request.groupId) {
																handleGroupToggle(request.groupId);
															}
														}}
													>
														{groupState[request.groupId || ""] ? "�" : "�"}
													</button>
												)}
											{truncateUrl(request.url)}
										</div>
										<div className="col-span-2 font-medium">
											{request.method}
										</div>
										<div className="col-span-2">{request.status}</div>
									</>
								) : (
									<div
										className="col-span-9 text-primary truncate"
										style={{
											paddingLeft: `${request.level * 12}px`,
										}}
										title={request.url}
									>
										{request.isGrouped &&
											request.children &&
											request.children.length > 0 && (
												<button
													type="button"
													className="mr-2 text-primary hover:text-primary/80"
													onClick={(e) => {
														e.stopPropagation();
														if (request.groupId) {
															handleGroupToggle(request.groupId);
														}
													}}
												>
													{groupState[request.groupId || ""] ? "�" : "�"}
												</button>
											)}
										{truncateUrl(request.url)}
									</div>
								)}
								<div className="col-span-3 text-primary font-mono">
									{typeof request.duration === "number"
										? formatDuration(request.duration)
										: "-"}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export default HttpRequestsTable;
