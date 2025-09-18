import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientEvent, ServerEvent } from "@/packages/types";

export enum ConnectionStatus {
	Connecting = "connecting",
	Connected = "connected",
	Disconnected = "disconnected",
	Error = "error",
}

export const useWS = (url: string, onMessage: (event: ServerEvent) => void) => {
	const wsRef = useRef<WebSocket | null>(null);
	const [status, setStatus] = useState<ConnectionStatus>(
		ConnectionStatus.Disconnected,
	);

	const messageHandlerRef = useRef(onMessage);

	messageHandlerRef.current = onMessage;

	useEffect(() => {
		let ws: WebSocket;
		let reconnectTimer: NodeJS.Timeout | null = null;

		function connect() {
			setStatus(ConnectionStatus.Connecting);
			ws = new window.WebSocket(url);
			wsRef.current = ws;

			ws.onopen = () => setStatus(ConnectionStatus.Connected);
			ws.onclose = () => {
				setStatus(ConnectionStatus.Disconnected);
				reconnectTimer = setTimeout(connect, 2000);
			};
			ws.onerror = () => setStatus(ConnectionStatus.Error);

			ws.onmessage = (event) => {
				try {
					const parsedEvent = JSON.parse(event.data) as ServerEvent;
					messageHandlerRef.current(parsedEvent);
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
	}, [url]);

	const send = useCallback((event: ClientEvent) => {
		if (!wsRef.current || wsRef.current.readyState !== wsRef.current.OPEN) {
			throw new Error(
				"Cannot send message to closed or non-established connection",
			);
		}

		wsRef.current.send(JSON.stringify(event));
	}, []);

	return {
		status,
		send,
	};
};
