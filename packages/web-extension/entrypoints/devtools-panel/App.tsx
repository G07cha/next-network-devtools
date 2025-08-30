import { useEffect, useMemo, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan, ServerEvent } from "@/packages/types";
import SidePanel from "./components/panel";
import HttpRequestsTable, {
	type HttpRequestData,
	transformSpanTreeToTableData,
} from "./components/table";
import WaterfallChart, {
	spanNodesToTimingData,
} from "./components/waterfall-chart";

type SpanNode = {
	request?: RequestSpan;
	response?: ResponseSpan;
	children: SpanNode[];
};

enum ConnectionStatus {
	Connecting = "connecting",
	Connected = "connected",
	Disconnected = "disconnected",
	Error = "error",
}

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
	const [selectedRequest, setSelectedRequest] =
		useState<HttpRequestData | null>(null);
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

	const tree = buildTree(spans);

	const handleRowClick = (request: HttpRequestData) => {
		setSelectedRequest(request);
		setIsPanelOpen(true);
	};

	const handlePanelClose = () => {
		setIsPanelOpen(false);
		setSelectedRequest(null);
	};

	return (
		<div className="flex flex-col h-full">
			<ConnectionBanner status={connectionStatus} />
			<WaterfallChart data={spanNodesToTimingData(spans)} />
			<div className="relative h-full">
				<HttpRequestsTable
					data={transformSpanTreeToTableData(Object.values(spans))}
					onRowClick={handleRowClick}
				/>
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

function ConnectionBanner({ status }: { status: ConnectionStatus }) {
	const colorClass = useMemo(() => {
		switch (status) {
			case ConnectionStatus.Connected:
				return "bg-success";
			case ConnectionStatus.Disconnected:
				return "bg-neutral";
			case ConnectionStatus.Error:
				return "bg-error";
			case ConnectionStatus.Connecting:
				return "bg-warning";
			default:
				return "bg-neutral";
		}
	}, [status]);

	const statusText = useMemo(() => {
		switch (status) {
			case ConnectionStatus.Connected:
				return "Connected to instrumentation server";
			case ConnectionStatus.Connecting:
				return "Connecting...";
			case ConnectionStatus.Disconnected:
				return "Disconnected. Retrying...";
			case ConnectionStatus.Error:
				return "Connection error";
			default:
				return "";
		}
	}, [status]);

	return (
		<div className="self-end flex items-center relative group m-4">
			<span className="absolute right-6 w-max bg-white text-dark px-2.5 py-1 rounded-lg text-sm font-medium shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
				{statusText}
			</span>
			<button
				type="button"
				className={`w-3 h-3 rounded-full block transition-shadow shadow-sm cursor-pointer ${colorClass}`}
				title={statusText}
				aria-label={statusText}
				tabIndex={0}
			/>
		</div>
	);
}

function RequestTree({ nodes }: { nodes: SpanNode[] }) {
	return (
		<ul className="list-none pl-0">
			{nodes.map((node) => (
				<RequestNode
					key={node.request?.id || node.response?.id}
					node={node}
					level={0}
				/>
			))}
		</ul>
	);
}

function RequestNode({ node, level }: { node: SpanNode; level: number }) {
	const [expanded, setExpanded] = useState(true);
	const req = node.request;
	const res = node.response;
	return (
		<li className={`my-3 ${level ? "pl-6 border-l-2 border-primary" : ""}`}>
			{node.children.length > 0 ? (
				<button
					type="button"
					className="flex items-center gap-2 cursor-pointer bg-none border-none p-0 w-full text-left"
					onClick={() => setExpanded((v) => !v)}
					aria-expanded={expanded}
				>
					<span className="font-bold text-lg text-primary select-none">
						{expanded ? "▼" : "▶"}
					</span>
					<span className="font-medium text-base">
						{req?.method} <span className="text-blue">{req?.url}</span>
					</span>
					{res && (
						<span
							className={`ml-2 font-medium ${res.status < 400 ? "text-primary" : "text-error"}`}
						>
							{res.status}
						</span>
					)}
				</button>
			) : (
				<div className="flex items-center gap-2 cursor-default">
					<span className="font-medium text-base">
						{req?.method} <span className="text-blue">{req?.url}</span>
					</span>
					{res && (
						<span
							className={`ml-2 font-medium ${res.status < 400 ? "text-primary" : "text-error"}`}
						>
							{res.status}
						</span>
					)}
				</div>
			)}
			{(expanded || node.children.length === 0) && (
				<div className="ml-8 mt-1">
					<RequestDetails req={req} res={res} />
					{node.children.length > 0 && <RequestTree nodes={node.children} />}
				</div>
			)}
		</li>
	);
}

function RequestDetails({
	req,
	res,
}: {
	req?: RequestSpan;
	res?: ResponseSpan;
}) {
	if (!req) return null;
	return (
		<div className="bg-panel rounded-lg p-3 mb-2 shadow-sm text-sm">
			<div>
				<strong>Request:</strong> {req.method} {req.url}
			</div>
			<div>
				<strong>Headers:</strong>
				<pre className="bg-code p-2 rounded">
					{JSON.stringify(req.headers, null, 2)}
				</pre>
			</div>
			{req.body && (
				<div>
					<strong>Body:</strong>
					<pre className="bg-code p-2 rounded">{req.body}</pre>
				</div>
			)}
			{res && (
				<>
					<div className="mt-2">
						<strong>Response:</strong> {res.status} {res.statusText}
					</div>
					<div>
						<strong>Headers:</strong>
						<pre className="bg-code p-2 rounded">
							{JSON.stringify(res.headers, null, 2)}
						</pre>
					</div>
					{res.body && (
						<div>
							<strong>Body:</strong>
							<pre className="bg-code p-2 rounded">{res.body}</pre>
						</div>
					)}
				</>
			)}
		</div>
	);
}
