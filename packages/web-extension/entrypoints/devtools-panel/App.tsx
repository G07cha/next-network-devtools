import { useMemo, useState } from "react";
import {
	filterEmptySpans,
	mapServerEventToSpanTree,
	type SpanTree,
} from "../../utils/spans";
import { useWS } from "../../utils/ws";
import { ConnectionBanner } from "./components/connection-banner";
import SidePanel from "./components/panel";
import HttpRequestsTable, {
	type HttpRequestData,
	transformSpanTreeToTableData,
} from "./components/table";
import WaterfallChart, {
	spanNodesToTimingData,
} from "./components/waterfall-chart";

const WS_URL = "ws://localhost:3300/";

export default function App() {
	const [spans, setSpans] = useState<SpanTree>({});
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const { send, status: wsStatus } = useWS(WS_URL, (event) => {
		setSpans((prev) => {
			const newSpans = mapServerEventToSpanTree(event, prev);

			return { ...newSpans };
		});
	});

	const handleRowClick = (request: HttpRequestData) => {
		setSelectedRequestId(request.id);
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

	const filteredSpans = useMemo(() => filterEmptySpans(spans), [spans]);
	const requestData = useMemo(
		() => transformSpanTreeToTableData(filteredSpans),
		[filteredSpans],
	);
	const selectedRequest = useMemo(
		() => requestData.find((request) => request.id === selectedRequestId),
		[requestData, selectedRequestId],
	);

	const selectedSpanNode = selectedRequestId
		? spans[selectedRequestId]
		: undefined;
	const serverSpanData = selectedSpanNode?.isServerSpan
		? selectedSpanNode.serverSpan
		: undefined;

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex items-center justify-between p-3">
				<button
					type="button"
					onClick={handleClearData}
					className="px-4 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
					title="Clear all recorded requests and spans"
				>
					Clear All
				</button>

				<ConnectionBanner status={wsStatus} />
			</div>
			<WaterfallChart data={spanNodesToTimingData(filteredSpans)} />
			<div className="relative flex-1 overflow-hidden">
				<HttpRequestsTable data={requestData} onRowClick={handleRowClick} />

				<SidePanel
					requestData={selectedRequest?.request}
					responseData={selectedRequest?.response}
					serverSpanData={serverSpanData}
					isOpen={isPanelOpen}
					onClose={handlePanelClose}
				/>
			</div>
		</div>
	);
}
