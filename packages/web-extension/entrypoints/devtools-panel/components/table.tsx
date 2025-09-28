import { Fragment, useMemo, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan, Span } from "@/packages/types";
import type { SpanTree } from "~/utils/spans";
import { truncate } from "~/utils/string";
import { cn } from "~/utils/style";
import { formatDuration } from "~/utils/time";
import { isTruthy } from "~/utils/type";

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
	children: HttpRequestData[];
}

export type SortColumn = "status" | "method" | "url" | "duration";
export type SortDirection = "asc" | "desc";

export interface TableProps {
	data: HttpRequestData[];
	loading?: boolean;
	onRowClick?: (request: HttpRequestData) => void;
	className?: string;
}

interface SortState {
	column: SortColumn | null;
	direction: SortDirection;
}

interface GroupState {
	[groupId: string]: boolean;
}

export function transformSpanTreeToTableData(
	spanTree: SpanTree,
): HttpRequestData[] {
	function processNode(
		node: SpanNode,
		parentId?: string,
	): HttpRequestData | undefined {
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
				response: undefined, // Server spans don't have response data
				children: [],
			};

			// Process child nodes (requests/responses or nested server spans) under this server span
			if (node.children.length > 0) {
				serverSpanData.children = node.children
					.map((child) => processNode(child, node.spanId))
					.filter(isTruthy);
			}
			return serverSpanData;
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
				children: [],
			};

			// Process child nodes (nested requests or server spans)
			if (node.children.length > 0) {
				requestData.children = node.children
					.map((child) => processNode(child, requestId))
					.filter(isTruthy);
			}

			return requestData;
		}

		return undefined;
	}

	// Find root nodes (nodes without parents or with parents not in the current tree)
	const rootNodes = Object.values(spanTree).filter((node) => {
		const parentId = node.parentSpanId;
		return !parentId || !spanTree[parentId];
	});

	// Process all root nodes - hierarchy is already built by the spans utility
	return (
		rootNodes
			.map((node) => processNode(node))
			.filter(isTruthy)
			// Sort by timestamp to maintain chronological order
			.sort((a, b) => a.timestamp - b.timestamp)
	);
}

const sortData = (
	data: HttpRequestData[],
	column: SortColumn,
	direction: SortDirection,
) =>
	data
		.toSorted((a, b) => {
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
		})
		.map(
			(entry): HttpRequestData => ({
				...entry,
				children:
					entry.children.length > 0
						? sortData(entry.children, column, direction)
						: entry.children,
			}),
		);

export function HttpRequestsTable({
	data,
	loading = false,
	onRowClick,
	className = "",
}: TableProps) {
	const [sortState, setSortState] = useState<SortState>({
		column: null,
		direction: "asc",
	});
	const [groupState, setGroupState] = useState<GroupState>({});
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const tableRef = useRef<HTMLDivElement>(null);

	const truncateUrl = (url: string) => truncate(url, 50);

	const sortedData = useMemo(() => {
		let processed = [...data];

		if (sortState.column) {
			processed = sortData(processed, sortState.column, sortState.direction);
		}

		return processed;
	}, [data, sortState]);

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

	const flatData = useMemo(() => {
		const flatten = (nodes: HttpRequestData[]): HttpRequestData[] =>
			nodes.flatMap((node) => [node, ...flatten(node.children)]);

		return flatten(sortedData);
	}, [sortedData]);

	const handleKeyDown = (event: React.KeyboardEvent) => {
		const currentIndex = flatData.findIndex(
			(item) => item.id === selectedRowId,
		);

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				if (currentIndex < flatData.length - 1) {
					setSelectedRowId(flatData[currentIndex + 1].id);
					onRowClick?.(flatData[currentIndex + 1]);
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (currentIndex > 0) {
					setSelectedRowId(flatData[currentIndex - 1].id);
					onRowClick?.(flatData[currentIndex - 1]);
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

	const renderRow = (request: HttpRequestData, level: number = 0) => (
		<Fragment key={request.id}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: easier to manage styling with div instead of button */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: covered by onKeyDown at table level */}
			<div
				key={request.id}
				className={cn(
					"border-b border-border-primary px-4 py-3 cursor-pointer transition-colors text-primary focus:outline-none",
					selectedRowId === request.id
						? "bg-primary/10"
						: "hover:bg-container-primary-hover",
				)}
				onClick={(e) => handleRowClick(request, e)}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the element is interactive
				tabIndex={0}
			>
				<div className="grid grid-cols-12 gap-4 items-center text-sm">
					{request.method || request.status ? (
						<>
							<div
								className="col-span-6 truncate"
								style={{
									paddingLeft: `${level * 12}px`,
								}}
								title={request.url}
							>
								{request.children && request.children.length > 0 && (
									<button
										type="button"
										className="mr-2 hover:text-secondary"
										onClick={(e) => {
											e.stopPropagation();
											handleGroupToggle(request.id);
										}}
									>
										{groupState[request.id] ? "▶" : "▼"}
									</button>
								)}
								{truncateUrl(request.url)}
							</div>
							<div className="col-span-2 font-medium">{request.method}</div>
							<div className="col-span-2">{request.status}</div>
						</>
					) : (
						<div
							className="col-span-10 truncate"
							style={{
								paddingLeft: `${level * 12}px`,
							}}
							title={request.url}
						>
							{request.children && request.children.length > 0 && (
								<button
									type="button"
									className="mr-2 hover:text-secondary"
									onClick={(e) => {
										e.stopPropagation();
										handleGroupToggle(request.id);
									}}
								>
									{groupState[request.id] ? "▶" : "▼"}
								</button>
							)}
							{truncateUrl(request.url)}
						</div>
					)}
					<div className="col-span-2 font-mono">
						{typeof request.duration === "number"
							? formatDuration(request.duration)
							: "-"}
					</div>
				</div>
			</div>
			{groupState[request.id]
				? null
				: request.children?.map((child) => renderRow(child, level + 1))}
		</Fragment>
	);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-tertiary">
				<div className="text-center">
					<div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
					<div>Loading requests...</div>
				</div>
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-tertiary">
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
		// biome-ignore lint/a11y/useSemanticElements: regular table just ain't going to cut it here with virtual scrolling
		<div
			className={cn("h-full overflow-auto", className)}
			onKeyDown={handleKeyDown}
			role="table"
			aria-label="HTTP Requests Table"
		>
			{/* Table Header */}
			<div className="border-b border-border-primary px-4 py-3 sticky top-0 bg-neutral-bg">
				<div
					className="grid grid-cols-12 gap-4 text-sm font-medium text-secondary 
						border-b-2 border-transparent"
					// ^ Border here mostly to align with the tabs in the panel because they also have a border for selected tab
				>
					<button
						type="button"
						className="col-span-6 text-left transition-colors flex items-center gap-1"
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
						className="col-span-2 text-left transition-colors flex items-center gap-1"
						onClick={() => handleSort("duration")}
					>
						Duration {renderSortIcon("duration")}
					</button>
				</div>
			</div>

			{/* Table Body */}
			<div ref={tableRef}>
				{sortedData.map((request) => renderRow(request))}
			</div>
		</div>
	);
}

export default HttpRequestsTable;
