import { useEffect, useMemo, useRef, useState } from "react";
import type { ServerEvent } from "@/packages/types";
import {
	filterEmptySpans,
	mapServerEventToSpanTree,
	type SpanTree,
} from "../../utils/spans";
import {
	ConnectionBanner,
	ConnectionStatus,
} from "./components/connection-banner";
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
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
		ConnectionStatus.Connecting,
	);
	const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
		null,
	);
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		let ws: WebSocket;
		let reconnectTimer: NodeJS.Timeout | null = null;

		function connect() {
			setConnectionStatus(ConnectionStatus.Connecting);
			ws = new window.WebSocket(WS_URL);
			wsRef.current = ws;

			ws.onopen = () => setConnectionStatus(ConnectionStatus.Connected);
			ws.onclose = () => {
				setConnectionStatus(ConnectionStatus.Disconnected);
				reconnectTimer = setTimeout(connect, 2000);
			};
			ws.onerror = () => setConnectionStatus(ConnectionStatus.Error);

			ws.onmessage = (event) => {
				try {
					const parsedEvent = JSON.parse(event.data) as ServerEvent;
					setSpans((prev) => {
						const newSpans = mapServerEventToSpanTree(parsedEvent, prev);

						return { ...newSpans };
					});
				} catch (e) {
					console.error("Error parsing WebSocket message:", e);
				}
			};
		}

		connect();
		return () => {
			wsRef.current?.close();
			if (reconnectTimer) clearTimeout(reconnectTimer);
		};
	}, []);

	const handleRowClick = (request: HttpRequestData) => {
		setSelectedRequestId(request.id);
		setIsPanelOpen(true);
	};

	const handlePanelClose = () => {
		setIsPanelOpen(false);
		setSelectedRequestId(null);
	};

	const handleClearData = () => {
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
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between p-3">
				<button
					type="button"
					onClick={handleClearData}
					className="px-4 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
					title="Clear all recorded requests and spans"
				>
					Clear All
				</button>

				<ConnectionBanner status={connectionStatus} />
			</div>
			<WaterfallChart data={spanNodesToTimingData(filteredSpans)} />
			<div className="relative h-full">
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
