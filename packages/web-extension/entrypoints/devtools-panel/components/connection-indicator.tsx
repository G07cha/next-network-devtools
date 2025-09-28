import { useMemo } from "react";
import { ConnectionStatus } from "~/utils/ws";

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
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
		<div className="flex items-center relative group">
			<span className="absolute right-6 w-max bg-container-primary text-text-primary px-2.5 py-1 rounded-lg text-sm font-medium shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
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
