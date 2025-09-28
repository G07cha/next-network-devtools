import { useMemo, useState } from "react";
import {
	filterInBetweenSpans,
	filterServerSpans,
	filterSpansWithoutChildren,
	mapServerEventToSpanTree,
	type SpanTree,
} from "~/utils/spans";
import { ConnectionStatus, useWS } from "~/utils/ws";
import { ConnectionErrorBanner } from "./components/connection-error-banner";
import { ConnectionIndicator } from "./components/connection-indicator";
import SidePanel from "./components/panel";
import HttpRequestsTable, {
	type HttpRequestData,
	transformSpanTreeToTableData,
} from "./components/table";
import WaterfallChart, {
	spanNodesToTimingData,
} from "./components/waterfall-chart";

const WS_URL = "ws://localhost:3300/";

enum SpanFilter {
	ALL = "All",
	ROOT_SPANS = "Condensed",
	REQUESTS_ONLY = "Requests",
}

export default function App() {
	const [spans, setSpans] = useState<SpanTree>({});
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const [catchUpReceived, setCatchUpReceived] = useState(false);
	const [spanFilter, setSpanFilter] = useState(SpanFilter.ROOT_SPANS);
	const {
		send,
		status: wsStatus,
		reconnectAttempt,
	} = useWS(WS_URL, (event) => {
		if (event.type === "catch-up") {
			setCatchUpReceived(true);
		}

		setSpans((prev) => {
			const newSpans = mapServerEventToSpanTree(event, prev);

			return { ...newSpans };
		});
	});

	const handleRowClick = (request: HttpRequestData) => {
		setSelectedRequestId(request.id);
		setIsPanelOpen(true);
	};

	const handleChartClick = (requestId: string) => {
		setSelectedRequestId(requestId);
		setIsPanelOpen(true);
	};

	const handlePanelClose = () => {
		setIsPanelOpen(false);
		setSelectedRequestId(null);
	};

	const handleClearData = () => {
		send({
			type: "clear-all",
			data: undefined,
		});
		setSpans({});
		setSelectedRequestId(null);
		setIsPanelOpen(false);
	};

	const filteredSpans = useMemo(() => {
		switch (spanFilter) {
			case SpanFilter.ALL:
				return spans;
			case SpanFilter.ROOT_SPANS:
				return filterInBetweenSpans(filterSpansWithoutChildren(spans));
			case SpanFilter.REQUESTS_ONLY:
				return filterServerSpans(spans);
		}
	}, [spans, spanFilter]);

	const requestData = useMemo(
		() => transformSpanTreeToTableData(filteredSpans),
		[filteredSpans],
	);
	const chartData = useMemo(
		() => spanNodesToTimingData(filteredSpans),
		[filteredSpans],
	);

	const selectedSpanNode = selectedRequestId
		? spans[selectedRequestId]
		: undefined;
	const serverSpanData = selectedSpanNode?.isServerSpan
		? selectedSpanNode.serverSpan
		: undefined;

	return (
		<div className="flex flex-col h-full overflow-hidden bg-container-primary">
			{(wsStatus === ConnectionStatus.Error ||
				(reconnectAttempt > 5 &&
					(wsStatus === ConnectionStatus.Connecting ||
						wsStatus === ConnectionStatus.Disconnected))) && (
				<ConnectionErrorBanner />
			)}
			<div className="flex items-center justify-between p-3">
				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleClearData}
						className="px-4 py-1 text-xs font-medium border border-border-primary rounded hover:bg-container-primary-hover bg-container-primary"
						title="Clear all recorded requests and spans"
					>
						Clear All
					</button>
					<label className="flex gap-2 items-center">
						View:
						<select
							className="border p-2 border-border-primary rounded hover:bg-container-primary-hover bg-container-primary text-primary"
							name="Span filter"
							onChange={(event) =>
								setSpanFilter(event.currentTarget.value as SpanFilter)
							}
							value={spanFilter}
						>
							{Object.values(SpanFilter).map((value) => (
								<option value={value} key={value}>
									{value}
								</option>
							))}
						</select>
					</label>
				</div>

				<ConnectionIndicator status={wsStatus} />
			</div>
			<WaterfallChart
				selectedRequestId={
					selectedSpanNode?.request?.id ?? selectedSpanNode?.spanId
				}
				data={chartData}
				onSpanClick={handleChartClick}
			/>
			<div className="relative flex-1 overflow-hidden">
				<HttpRequestsTable
					data={requestData}
					onRowClick={handleRowClick}
					loading={!catchUpReceived && requestData.length === 0}
				/>

				<SidePanel
					requestData={selectedSpanNode?.request}
					responseData={selectedSpanNode?.response}
					serverSpanData={serverSpanData}
					isOpen={isPanelOpen}
					onClose={handlePanelClose}
				/>
			</div>
		</div>
	);
}
