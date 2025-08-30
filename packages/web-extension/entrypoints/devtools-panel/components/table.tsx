import { useCallback, useMemo, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan } from "@/packages/types";
import { cn } from "../../../utils/style";

type SpanNode = {
	request?: RequestSpan;
	response?: ResponseSpan;
	children: SpanNode[];
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

export function transformSpanNodesToTableData(
	spans: Record<string, SpanNode>,
): HttpRequestData[] {
	const result: HttpRequestData[] = [];
	const groupMap = new Map<string, HttpRequestData[]>();

	Object.entries(spans).forEach(([id, node]) => {
		if (!node.request) return;

		const duration =
			node.request.start && node.response?.end
				? node.response.end - node.request.start
				: undefined;

		const parentSpanId = node.request.parentSpan?.spanId;

		const requestData: HttpRequestData = {
			id,
			parentSpanId,
			status: node.response?.status,
			method: node.request.method,
			url: node.request.url,
			duration,
			timestamp: node.request.start,
			request: node.request,
			response: node.response,
			level: 0,
			isGrouped: false,
			children: [],
		};

		if (parentSpanId) {
			if (!groupMap.has(parentSpanId)) {
				groupMap.set(parentSpanId, []);
			}
			groupMap.get(parentSpanId)?.push(requestData);
		} else {
			result.push(requestData);
		}
	});

	result.forEach((request) => {
		if (groupMap.has(request.id)) {
			const children = groupMap.get(request.id);
			if (!children) return;
			request.children = children;
			request.isGrouped = true;
			request.groupId = request.id;

			children.forEach((child) => {
				child.level = 1;
				child.groupId = request.id;
			});
		}
	});

	const flatResult: HttpRequestData[] = [];
	result.forEach((request) => {
		flatResult.push(request);
		if (request.children && request.children.length > 0) {
			flatResult.push(...request.children);
		}
	});

	return flatResult.sort((a, b) => a.timestamp - b.timestamp);
}

export function transformSpanTreeToTableData(
	nodes: SpanNode[],
): HttpRequestData[] {
	const result: HttpRequestData[] = [];

	function processNode(
		node: SpanNode,
		level: number = 0,
		parentId?: string,
	): void {
		if (!node.request) return;

		const duration =
			node.request.start && node.response?.end
				? node.response.end - node.request.start
				: undefined;

		const requestData: HttpRequestData = {
			id: node.request.id,
			parentSpanId: parentId,
			status: node.response?.status,
			method: node.request.method,
			url: node.request.url,
			duration,
			timestamp: node.request.start,
			request: node.request,
			response: node.response,
			level,
			isGrouped: node.children.length > 0,
			groupId: node.children.length > 0 ? node.request.id : undefined,
			children: [],
		};

		result.push(requestData);

		if (node.children.length > 0) {
			node.children.forEach((child) => {
				if (node.request?.id) {
					processNode(child, level + 1, node.request.id);
				}
			});
		}
	}

	nodes.forEach((node) => processNode(node));
	return result;
}

function StatusCode({ status }: { status: number }) {
	return (
		<span
			className={cn(
				"font-medium",
				(() => {
					switch (status) {
						case 200:
							return "text-blue bg-blue/10";
						case 400:
							return "text-warning bg-warning/10";
						case 404:
							return "text-error bg-error/10";
						default:
							return "text-gray-400 bg-gray-400/10";
					}
				})(),
			)}
		>
			{status}
		</span>
	);
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

	const formatDuration = (duration?: number) => {
		if (duration === undefined || duration === null) return "";
		return `${duration.toFixed(2)}ms`;
	};

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

		return processed.filter((item) => {
			if (item.groupId && !groupState[item.groupId]) {
				return false;
			}
			return true;
		});
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
		event: React.MouseEvent,
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
				}
				break;
			case "ArrowUp":
				event.preventDefault();
				if (currentIndex > 0) {
					setSelectedRowId(processedData[currentIndex - 1].id);
				}
				break;
			case "Enter":
				event.preventDefault();
				if (selectedRowId) {
					const selectedRequest = processedData.find(
						(item) => item.id === selectedRowId,
					);
					if (selectedRequest) {
						onRowClick?.(selectedRequest);
					}
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
			<div className="flex h-full items-center justify-center h-32 text-error bg-panel rounded-lg border border-error/20">
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
			<div className="flex h-full items-center justify-center h-32 text-gray-400 bg-panel rounded-lg border border-gray-600">
				<div className="text-center">
					<div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
					<div>Loading requests...</div>
				</div>
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="flex h-full items-center justify-center h-32 text-gray-400 bg-panel rounded-lg border border-gray-600 border-dashed">
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
				"rounded-lg border h-full border-gray-600 overflow-hidden",
				className,
			)}
			onKeyDown={handleKeyDown}
			role="table"
			aria-label="HTTP Requests Table"
		>
			{/* Table Header */}
			<div className="border-b border-gray-600 px-4 py-3">
				<div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-300">
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
				className="overflow-auto"
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
								request.level > 0 ? "" : "",
							)}
							onClick={(e) => handleRowClick(request, e)}
							tabIndex={0}
							style={{
								paddingLeft: `${16 + request.level * 24}px`,
								...(virtualScrolling ? { height: `${ITEM_HEIGHT}px` } : {}),
							}}
						>
							<div className="grid grid-cols-12 gap-4 items-center text-sm">
								<div
									className="col-span-5 text-gray-300 truncate"
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
								<div className="col-span-2 font-medium">{request.method}</div>
								<div className="col-span-2">{request.status}</div>
								<div className="col-span-3 text-gray-400 font-mono">
									{formatDuration(request.duration)}
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
