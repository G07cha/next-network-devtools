import { useMemo } from "react";
import type { SpanNode, SpanTree } from "~/utils/spans";
import { cn } from "~/utils/style";
import { formatDuration } from "~/utils/time";

interface TimingData {
	id: string;
	start: number;
	end: number;
	label?: string;
	method?: string;
	url?: string;
	status?: number;
}

interface WaterfallChartProps {
	data: TimingData[];
	height?: number;
	rowHeight?: number;
	padding?: number;
	selectedRequestId?: string;
	onSpanClick?: (spanId: string) => void;
}

interface PositionedTiming extends TimingData {
	row: number;
	left: number;
	width: number;
}

// Utility function to convert span nodes to timing data
export function spanNodesToTimingData(spans: SpanTree): TimingData[] {
	const processNode = (node: SpanNode): TimingData[] => {
		let nodes: TimingData[] = [];
		if (node.children.length > 0) {
			nodes = node.children.flatMap((child) => processNode(child));
		}

		if (
			node.isServerSpan &&
			node.serverSpan?.start &&
			node.serverSpan?.end?.end
		) {
			return [
				...nodes,
				{
					id: node.spanId || "unknown",
					start: node.serverSpan.start.start,
					end: node.serverSpan.end.end,
					method: "SERVER",
					url: node.serverSpan.start.id || "Server Span",
					status: undefined,
					label: `Server: ${node.serverSpan.start.id || "Unknown"}`,
				},
			];
		} else if (node.request && node.response?.end) {
			return [
				...nodes,
				{
					id: node.request.id || "unknown",
					start: node.request.start,
					end: node.response.end,
					method: node.request.method,
					url: node.request.url,
					status: node.response?.status,
					label: `${node.request.method} ${node.request.url}`,
				},
			];
		}
		return nodes;
	};

	const rootNodes = Object.values(spans).filter((node) => {
		const parentId = node.parentSpanId;
		return !parentId || !spans[parentId];
	});

	return rootNodes.flatMap((node) => processNode(node));
}

export function WaterfallChart({
	data,
	height = 150,
	rowHeight = 4,
	padding = 8,
	selectedRequestId,
	onSpanClick,
}: WaterfallChartProps) {
	const minTime = useMemo(
		() => Math.floor(Math.min(...data.map((d) => d.start))),
		[data],
	);
	const maxTime = useMemo(
		() => Math.ceil(Math.max(...data.map((d) => d.end))),
		[data],
	);
	const timeRange = Math.ceil((maxTime - minTime) / 1000) * 1000;

	const positionedData = useMemo(() => {
		if (!data.length) return [];

		// Sort data by start time
		const sortedData = [...data].sort((a, b) => a.start - b.start);

		// Calculate time bounds
		// const minTime = Math.min(...sortedData.map((d) => d.start));
		// const maxTime = Math.max(...sortedData.map((d) => d.end));
		// const timeRange = maxTime - minTime;

		if (timeRange === 0) {
			// Handle case where all requests have the same timing
			return sortedData.map((item, index) => ({
				...item,
				row: index,
				left: 10,
				width: 80,
			}));
		}

		// Track which rows are occupied by time ranges
		const rowOccupancy: Array<{ start: number; end: number }[]> = [];

		const positioned: PositionedTiming[] = sortedData.map((item) => {
			const duration = item.end - item.start;
			const left = ((item.start - minTime) / timeRange) * 100;
			const width = Math.max((duration / timeRange) * 100, 1); // Minimum 1% width

			// Find the first available row
			let row = 0;
			while (true) {
				// Initialize row if it doesn't exist
				if (!rowOccupancy[row]) {
					rowOccupancy[row] = [];
				}

				// Check if this item overlaps with any existing items in this row
				const overlaps = rowOccupancy[row].some(
					(occupant) => item.start < occupant.end && item.end > occupant.start,
				);

				if (!overlaps) {
					// This row is available
					rowOccupancy[row].push({ start: item.start, end: item.end });
					break;
				}

				row++;
			}

			return {
				...item,
				row,
				left,
				width,
			};
		});

		return positioned;
	}, [data, timeRange, minTime]);

	const totalRows =
		positionedData.length > 0
			? Math.max(...positionedData.map((d) => d.row), 0) + 1
			: 0;
	const chartHeight = Math.max(
		height,
		totalRows * (rowHeight + padding) + padding + 40,
	); // +40 for time axis

	const getStatusColor = (status?: number, method?: string) => {
		// Special color for server spans
		if (method === "SERVER") return "bg-info";
		if (!status) return "bg-neutral-bg";
		if (status >= 200 && status < 300) return "bg-success-bg";
		if (status >= 300 && status < 400) return "bg-warning-bg";
		if (status >= 400 && status < 500) return "bg-error-bg";
		if (status >= 500) return "bg-error-bg";
		return "bg-neutral-bg";
	};

	if (!data.length) {
		return (
			<div
				className="flex items-center justify-center h-32 text-tertiary-content bg-neutral-light"
				style={{ height: `${chartHeight}px` }}
			>
				No timing data available
			</div>
		);
	}

	// Calculate time labels for the axis
	return (
		<div
			className="w-full border-y border-y-border-primary overflow-hidden"
			style={{ minHeight: `${chartHeight}px` }}
		>
			{/* Chart Container */}
			<div className="relative" style={{ height: `${chartHeight}px` }}>
				{/* Grid lines */}
				<div className="absolute inset-0">
					{Array.from({ length: 11 }, (_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static list
							key={`grid-${i}`}
							className="absolute top-0 bottom-0 w-px bg-secondary-border"
							style={{ left: `${i * 10}%` }}
						/>
					))}
				</div>

				{/* Time axis */}
				<div className="h-8 bg-neutral-bg border-b border-secondary-border flex items-center">
					{Array.from({ length: 11 }, (_, i) => {
						const timePoint = (timeRange * i) / 10;
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={`time-${i}`}
								className="absolute text-xs text-secondary-content"
								style={{ left: `${i * 10}%` }}
							>
								{i === 0 ? null : formatDuration(timePoint)}
							</div>
						);
					})}
				</div>

				{/* Timing bars */}
				<div className="relative">
					{positionedData.map((item) => (
						<button
							type="button"
							onClick={() => onSpanClick?.(item.id)}
							key={item.id}
							className={cn(
								"absolute group cursor-pointer",
								getStatusColor(item.status, item.method),
								selectedRequestId && item.id === selectedRequestId
									? "border border-info"
									: undefined,
							)}
							style={{
								top: `${item.row * (rowHeight + padding) + padding}px`,
								left: `${item.left}%`,
								width: `${item.width}%`,
								height: `${rowHeight}px`,
							}}
							title={item.label}
						></button>
					))}
				</div>
			</div>
		</div>
	);
}

export default WaterfallChart;
