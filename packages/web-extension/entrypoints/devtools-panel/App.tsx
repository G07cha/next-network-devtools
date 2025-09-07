import { useEffect, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan, ServerEvent } from "@/packages/types";
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

export type SpanNode = {
	request?: RequestSpan;
	response?: ResponseSpan;
	children: SpanNode[];
};

function buildTree(spans: Record<string, SpanNode>): SpanNode[] {
	const roots: SpanNode[] = [];
	Object.values(spans).forEach((node) => {
		if (!node.request?.parentSpan?.spanId) {
			roots.push(node);
		} else {
			const parent = spans[node.request.parentSpan.spanId];
			if (parent) parent.children.push(node);
			else roots.push(node);
		}
	});
	return roots;
}

const WS_URL = "ws://localhost:3300/";

export default function App() {
	const [spans, setSpans] = useState<Record<string, SpanNode>>({});
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
				console.log("event", event);
				try {
					const { type, data } = JSON.parse(event.data) as ServerEvent;
					setSpans((prev) => {
						const id = data.id;
						const node = prev[id] || { children: [] };
						if (type === "request") {
							node.request = data;
						} else if (type === "response") {
							node.response = data;
						}
						return { ...prev, [id]: node };
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

	// Intended for RequestTree component
	const tree = buildTree(spans);

	const handleRowClick = (request: HttpRequestData) => {
		setSelectedRequestId(request.id);
		setIsPanelOpen(true);
	};

	const handlePanelClose = () => {
		setIsPanelOpen(false);
		setSelectedRequestId(null);
	};

	const requestData = transformSpanTreeToTableData(Object.values(spans));
	const selectedRequest = requestData.find(
		(request) => request.id === selectedRequestId,
	);

	return (
		<div className="flex flex-col h-full">
			<ConnectionBanner status={connectionStatus} />
			<WaterfallChart data={spanNodesToTimingData(spans)} />
			<div className="relative h-full">
				<HttpRequestsTable data={requestData} onRowClick={handleRowClick} />
				{/* <RequestTree nodes={tree} /> */}

				{/* Side Panel */}
				<SidePanel
					requestData={selectedRequest?.request}
					responseData={selectedRequest?.response}
					isOpen={isPanelOpen}
					onClose={handlePanelClose}
				/>
			</div>
		</div>
	);
}
