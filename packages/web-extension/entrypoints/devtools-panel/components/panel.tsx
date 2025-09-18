import {
	Fragment,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { RequestSpan, ResponseSpan, Span } from "@/packages/types";
import { useFocusTrap } from "../../../utils/dom";
import { cn } from "../../../utils/style";
import { formatDuration } from "../../../utils/time";
import { CodeBlock } from "./code-block";

export interface SidePanelProps {
	requestData?: RequestSpan;
	responseData?: ResponseSpan;
	serverSpanData?: {
		start?: Span;
		end?: Span;
		isActive: boolean;
	};
	isOpen: boolean;
	onClose: () => void;
	className?: string;
	isLoading?: boolean;
}

const MIN_PANEL_WIDTH = 200;

type TabType = "request" | "response" | "server-span";

type PropertyListEntry = {
	label: string;
	value: ReactNode;
	valueContainerClassName?: string;
};

const PropertyList = ({
	data,
	className,
}: {
	data: readonly PropertyListEntry[];
	className?: string;
}) => {
	return (
		<div
			className={cn("gap-2 text-sm grid grid-cols-2 text-gray-400", className)}
		>
			{data.map(({ label, value, valueContainerClassName }) => (
				<Fragment key={label}>
					<span>{label}</span>
					<span
						className={cn("font-mono text-primary", valueContainerClassName)}
					>
						{value}
					</span>
				</Fragment>
			))}
		</div>
	);
};

interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	defaultExpanded?: boolean;
	badge?: string | number;
}

function CollapsibleSection({
	title,
	children,
	defaultExpanded = true,
	badge,
}: CollapsibleSectionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div className="mb-4">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center justify-between w-full p-3 rounded-lg transition-colors"
				aria-expanded={expanded}
			>
				<div className="flex items-center gap-2">
					<span className="text-primary font-medium text-sm">
						{expanded ? "▼" : "▶"}
					</span>
					<span className="font-medium text-sm">{title}</span>
					{badge !== undefined && (
						<span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">
							{badge}
						</span>
					)}
				</div>
			</button>
			{expanded && (
				<div className="mt-2 p-3 rounded-lg border border-gray-700">
					{children}
				</div>
			)}
		</div>
	);
}

interface HeadersDisplayProps {
	headers: Record<string, string>;
	title: string;
}

function HeadersDisplay({ headers, title }: HeadersDisplayProps) {
	const headerEntries = Object.entries(headers || {});

	if (headerEntries.length === 0) {
		return (
			<div className="text-gray-400 text-sm italic">
				No {title.toLowerCase()}
			</div>
		);
	}

	return (
		<PropertyList
			data={headerEntries.map(([key, value]) => ({
				label: key,
				value,
				valueContainerClassName: "break-all",
			}))}
		/>
	);
}

function RequestTab({ requestData }: { requestData?: RequestSpan }) {
	const queryParams = useMemo(() => {
		if (!requestData?.url) return {};
		try {
			const url = new URL(requestData.url);
			const params: Record<string, string> = {};
			url.searchParams.forEach((value, key) => {
				params[key] = value;
			});
			return params;
		} catch {
			return {};
		}
	}, [requestData?.url]);

	const getMethodColor = (method: string) => {
		switch (method?.toUpperCase()) {
			case "GET":
				return "text-blue bg-blue/10";
			case "POST":
				return "text-primary bg-primary/10";
			case "PUT":
				return "text-warning bg-warning/10";
			case "DELETE":
				return "text-error bg-error/10";
			case "PATCH":
				return "text-warning bg-warning/10";
			default:
				return "text-gray-400 bg-gray-400/10";
		}
	};

	if (!requestData) {
		return (
			<div className="flex items-center justify-center h-64 text-gray-400">
				<div className="text-center">
					<div className="text-lg font-semibold mb-2">No Request Data</div>
					<div className="text-sm">Request information is not available</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Method and URL */}
			<div className="p-4 rounded-lg border border-gray-600">
				<div className="flex items-center gap-3 mb-3">
					<span
						className={`px-3 py-1 rounded font-medium text-sm ${getMethodColor(requestData.method)}`}
					>
						{requestData.method}
					</span>
					<span className="text-gray-400 text-xs">
						{new Date(requestData.start).toLocaleString()}
					</span>
				</div>
				<div className="font-mono text-sm text-primary break-all">
					{requestData.url}
				</div>
			</div>

			{/* Query Parameters */}
			{Object.keys(queryParams).length > 0 && (
				<CollapsibleSection
					title="Query Parameters"
					badge={Object.keys(queryParams).length}
				>
					<HeadersDisplay headers={queryParams} title="Query Parameters" />
				</CollapsibleSection>
			)}

			{/* Request Headers */}
			<CollapsibleSection
				title="Request Headers"
				badge={Object.keys(requestData.headers || {}).length}
			>
				<HeadersDisplay headers={requestData.headers} title="Request Headers" />
			</CollapsibleSection>

			{/* Request Body */}
			{requestData.body && (
				<CollapsibleSection title="Request Body">
					<CodeBlock content={requestData.body} />
				</CollapsibleSection>
			)}

			{/* Metadata */}
			<CollapsibleSection title="Metadata" defaultExpanded={false}>
				<PropertyList
					data={[
						{
							label: "Span ID:",
							value: requestData.spanId,
							valueContainerClassName: "break-all",
						},
						{
							label: "Trace ID:",
							value: requestData.traceId,
							valueContainerClassName: "break-all",
						},
						{
							label: "Request ID:",
							value: requestData.id,
							valueContainerClassName: "break-all",
						},
						...(requestData.parentSpan
							? [
									{
										label: "Parent Span:",
										value: requestData.parentSpan?.spanId,
										valueContainerClassName: "break-all",
									},
								]
							: []),
					]}
				/>
			</CollapsibleSection>
		</div>
	);
}

function ResponseTab({ responseData }: { responseData?: ResponseSpan }) {
	const getStatusColor = (status: number) => {
		if (status >= 200 && status < 300) return "text-primary";
		if (status >= 300 && status < 400) return "text-warning";
		if (status >= 400 && status < 500) return "text-error";
		if (status >= 500) return "text-error";
		return "text-gray-400";
	};

	const getStatusBadgeColor = (status: number) => {
		if (status >= 200 && status < 300) return "bg-primary/20 text-primary";
		if (status >= 300 && status < 400) return "bg-warning/20 text-warning";
		if (status >= 400 && status < 500) return "bg-error/20 text-error";
		if (status >= 500) return "bg-error/20 text-error";
		return "bg-gray-400/20 text-gray-400";
	};

	const responseTime = useMemo(() => {
		if (!responseData?.start || !responseData?.end) return null;
		return responseData.end - responseData.start;
	}, [responseData]);

	const contentType = responseData?.headers?.["content-type"] || "Unknown";
	const contentLength = responseData?.headers?.["content-length"];

	if (!responseData) {
		return (
			<div className="flex items-center justify-center h-64 text-gray-400">
				<div className="text-center">
					<div className="text-lg font-semibold mb-2">No Response Data</div>
					<div className="text-sm">Response information is not available</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Status and Basic Info */}
			<div className="p-4 rounded-lg border border-gray-600">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-3">
						<span
							className={`px-3 py-1 rounded font-medium text-sm ${getStatusBadgeColor(responseData.status)}`}
						>
							{responseData.status}
						</span>
						<span
							className={`font-medium ${getStatusColor(responseData.status)}`}
						>
							{responseData.statusText}
						</span>
					</div>
					{responseTime && (
						<span className="text-gray-400 text-sm">
							{formatDuration(responseTime)}ms
						</span>
					)}
				</div>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
					<div className="flex justify-between">
						<span className="text-gray-400">Content-Type:</span>
						<span className="text-gray-300 font-mono">{contentType}</span>
					</div>
					{contentLength && (
						<div className="flex justify-between">
							<span className="text-gray-400">Content-Length:</span>
							<span className="text-gray-300 font-mono">
								{contentLength} bytes
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Response Headers */}
			<CollapsibleSection
				title="Response Headers"
				badge={Object.keys(responseData.headers || {}).length}
			>
				<HeadersDisplay
					headers={responseData.headers}
					title="Response Headers"
				/>
			</CollapsibleSection>

			{/* Response Body */}
			{responseData.body && (
				<CollapsibleSection title="Response Body">
					<CodeBlock content={responseData.body} />
				</CollapsibleSection>
			)}

			{/* Timing & Metadata */}
			<CollapsibleSection title="Timing & Metadata" defaultExpanded={false}>
				<div className="space-y-2 text-sm">
					{responseTime && (
						<div className="flex justify-between">
							<span className="text-gray-400">Response Time:</span>
							<span className="font-mono text-gray-300">
								{formatDuration(responseTime)}ms
							</span>
						</div>
					)}
					<div className="flex justify-between">
						<span className="text-gray-400">Start Time:</span>
						<span className="font-mono text-gray-300">
							{new Date(responseData.start).toLocaleString()}
						</span>
					</div>
					{responseData.end && (
						<div className="flex justify-between">
							<span className="text-gray-400">End Time:</span>
							<span className="font-mono text-gray-300">
								{new Date(responseData.end).toLocaleString()}
							</span>
						</div>
					)}
					<div className="flex justify-between">
						<span className="text-gray-400">Span ID:</span>
						<span className="font-mono text-gray-300">
							{responseData.spanId}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-gray-400">Trace ID:</span>
						<span className="font-mono text-gray-300">
							{responseData.traceId}
						</span>
					</div>
				</div>
			</CollapsibleSection>
		</div>
	);
}

function ServerSpanTab({
	serverSpanData,
}: {
	serverSpanData?: { start?: Span; end?: Span; isActive: boolean };
}) {
	if (!serverSpanData) {
		return (
			<div className="flex items-center justify-center h-64 text-gray-400">
				<div className="text-center">
					<div className="text-lg font-semibold mb-2">No Server Span Data</div>
					<div className="text-sm">
						Server span information is not available
					</div>
				</div>
			</div>
		);
	}

	const duration =
		serverSpanData.start && serverSpanData.end?.end
			? serverSpanData.end.end - serverSpanData.start.start
			: undefined;

	return (
		<div className="space-y-4">
			{/* Server Span Status */}
			<div className="p-4 rounded-lg border border-gray-600">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-3">
						<span
							className={`px-3 py-1 rounded font-medium text-sm ${
								serverSpanData.isActive
									? "bg-warning/20 text-warning"
									: "bg-primary/20 text-primary"
							}`}
						>
							{serverSpanData.isActive ? "ACTIVE" : "COMPLETED"}
						</span>
						<span className="font-medium text-primary">
							{serverSpanData.start?.id || "Unknown Server Span"}
						</span>
					</div>
					{duration && (
						<span className="text-gray-400 text-sm">
							{formatDuration(duration)}
						</span>
					)}
				</div>
			</div>

			{/* Timing Information */}
			<CollapsibleSection title="Timing Information" defaultExpanded={true}>
				<PropertyList
					data={[
						...(serverSpanData.start
							? [
									{
										label: "Start Time:",
										value: new Date(
											serverSpanData.start.start,
										).toLocaleString(),
										valueContainerClassName: "break-all",
									},
								]
							: []),
						...(typeof serverSpanData.end?.end === "number"
							? [
									{
										label: "End Time:",
										value: new Date(serverSpanData.end.end).toLocaleString(),
										valueContainerClassName: "break-all",
									},
								]
							: []),
						...(duration
							? [
									{
										label: "Duration:",
										value: formatDuration(duration),
										valueContainerClassName: "break-all",
									},
								]
							: []),
					]}
				/>
			</CollapsibleSection>

			{/* Server Span Metadata */}
			<CollapsibleSection title="Server Span Metadata" defaultExpanded={false}>
				<PropertyList
					data={[
						...(serverSpanData.start
							? [
									{
										label: "Span ID:",
										value: serverSpanData.start.spanId,
										valueContainerClassName: "break-all",
									},
									{
										label: "Trace ID:",
										value: serverSpanData.start.traceId,
										valueContainerClassName: "break-all",
									},
									...(serverSpanData.start.parentSpan
										? [
												{
													label: "Parent Span:",
													value: serverSpanData.start.parentSpan.spanId,
													valueContainerClassName: "break-all",
												},
											]
										: []),
								]
							: []),
					]}
				/>
			</CollapsibleSection>
		</div>
	);
}

function LoadingSkeleton() {
	return (
		<div className="space-y-4 animate-pulse">
			<div className="h-20 bg-gray-800 rounded-lg" />
			<div className="h-32 bg-gray-800 rounded-lg" />
			<div className="h-24 bg-gray-800 rounded-lg" />
			<div className="h-40 bg-gray-800 rounded-lg" />
		</div>
	);
}

export default function SidePanel({
	requestData,
	responseData,
	serverSpanData,
	isOpen,
	onClose,
	className = "",
	isLoading = false,
}: SidePanelProps) {
	const [activeTab, setActiveTab] = useState<TabType>(
		serverSpanData ? "server-span" : "request",
	);
	const [panelWidth, setPanelWidth] = useState(1000);
	const [isResizing, setIsResizing] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const resizeHandleRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const updateWidth = (containerWidth: number) => {
			const maxWidth = Math.round(containerWidth - (containerWidth / 100) * 10);
			setPanelWidth((prevWidth) => {
				console.log(maxWidth, prevWidth);

				return Math.min(prevWidth, maxWidth);
			});
		};

		const observer = new ResizeObserver(([container]) => {
			const containerWidth = container.contentRect.width;
			updateWidth(containerWidth);
		});

		if (panelRef.current?.parentElement) {
			observer.observe(panelRef.current.parentElement);
			updateWidth(panelRef.current.parentElement.clientWidth);
		}

		return () => {
			if (panelRef.current?.parentElement) {
				observer.unobserve(panelRef.current.parentElement);
			}
			observer.disconnect();
		};
	}, [isOpen]);

	// Reset active tab when entry changes
	useEffect(() => {
		if (serverSpanData) {
			setActiveTab("server-span");
		} else {
			setActiveTab("request");
		}
	}, [serverSpanData]);

	// Focus management
	useEffect(() => {
		if (isOpen && closeButtonRef.current) {
			closeButtonRef.current.focus();
		}
	}, [isOpen]);

	// Escape key handler
	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && isOpen) {
				event.preventDefault();
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("keydown", handleEscape);
			return () => document.removeEventListener("keydown", handleEscape);
		}
	}, [isOpen, onClose]);

	// Outside click handler
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				panelRef.current &&
				!panelRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen, onClose]);

	useFocusTrap(panelRef, { disabled: !isOpen });

	const handleTabChange = (tab: TabType) => {
		setActiveTab(tab);
	};

	// Resize functionality
	const handleMouseDown = useCallback((event: React.MouseEvent) => {
		event.preventDefault();
		setIsResizing(true);
		const width = panelRef.current?.parentElement?.clientWidth ?? 0;
		const maxWidth = width - (width / 100) * 10;

		let prevX = event.clientX;

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const deltaX = prevX - moveEvent.clientX;
			const panelWidth = panelRef.current?.clientWidth ?? 0;

			if (
				deltaX === 0 ||
				(panelWidth <= MIN_PANEL_WIDTH && deltaX < 0) ||
				(panelWidth >= maxWidth && deltaX > 0)
			) {
				return;
			}
			prevX = moveEvent.clientX;
			setPanelWidth((prevWidth) => prevWidth + deltaX);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}, []);

	// Prevent text selection during resize
	useEffect(() => {
		if (isResizing) {
			document.body.style.userSelect = "none";
			document.body.style.cursor = "ew-resize";
		} else {
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		}

		return () => {
			document.body.style.userSelect = "";
			document.body.style.cursor = "";
		};
	}, [isResizing]);

	if (!isOpen) return null;

	return (
		<div
			ref={panelRef}
			className={`
					absolute right-0 top-0 bottom-0 left-auto inset-0 z-50 items-stretch justify-end
					bg-white border-l border-gray-600 shadow-2xl
					h-full overflow-hidden flex max-w-11/12 min-w-60
					transform transition-transform duration-300 ease-in-out
					${isOpen ? "translate-x-0" : "translate-x-full"}
					${className}
				`}
			style={{ width: `${panelWidth}px` }}
			role="dialog"
			aria-labelledby="panel-title"
		>
			{/* Resize Handle */}
			<button
				ref={resizeHandleRef}
				type="button"
				className={`
						absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10
						hover:bg-primary/30 transition-colors border-none bg-transparent
						focus:outline-none focus:bg-primary/40
						${isResizing ? "bg-primary/50" : ""}
					`}
				onMouseDown={handleMouseDown}
				title="Drag to resize panel"
				aria-label="Resize panel"
			/>

			{/* Panel Content */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-gray-600">
					<h2 id="panel-title" className="text-lg font-semibold text-primary">
						Request Details
					</h2>
					<button
						ref={closeButtonRef}
						type="button"
						onClick={onClose}
						className="p-2 hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
						aria-label="Close panel"
						title="Close panel"
					>
						<svg
							className="w-5 h-5 text-gray-400"
							fill="none"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Tab Navigation */}
				<div className="flex border-b border-gray-600">
					{serverSpanData && (
						<button
							type="button"
							onClick={() => handleTabChange("server-span")}
							className={`
									flex-1 py-3 px-4 text-sm font-medium transition-colors
									focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset
									${
										activeTab === "server-span"
											? "text-primary border-b-2 border-primary bg-gray-800/50"
											: "text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
									}
								`}
							role="tab"
							aria-selected={activeTab === "server-span"}
							aria-controls="server-span-panel"
						>
							Server Span
						</button>
					)}
					<button
						type="button"
						onClick={() => handleTabChange("request")}
						className={`
								flex-1 py-3 px-4 text-sm font-medium transition-colors
								focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset
								${
									activeTab === "request"
										? "text-primary border-b-2 border-primary bg-gray-800/50"
										: "text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
								}
							`}
						role="tab"
						aria-selected={activeTab === "request"}
						aria-controls="request-panel"
						disabled={!requestData}
					>
						Request
						{!requestData && (
							<span className="ml-1 text-xs text-gray-500">(N/A)</span>
						)}
					</button>
					<button
						type="button"
						onClick={() => handleTabChange("response")}
						className={`
								flex-1 py-3 px-4 text-sm font-medium transition-colors
								focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset
								${
									activeTab === "response"
										? "text-primary border-b-2 border-primary bg-gray-800/50"
										: "text-gray-400 hover:text-gray-300 hover:bg-gray-800/30"
								}
							`}
						role="tab"
						aria-selected={activeTab === "response"}
						aria-controls="response-panel"
						disabled={!responseData}
					>
						Response
						{!responseData && (
							<span className="ml-1 text-xs text-gray-500">(N/A)</span>
						)}
					</button>
				</div>

				{/* Tab Content */}
				<div className="flex-1 overflow-auto">
					<div className="p-4">
						{isLoading ? (
							<LoadingSkeleton />
						) : (
							<>
								{serverSpanData && (
									<div
										id="server-span-panel"
										role="tabpanel"
										aria-labelledby="server-span-tab"
										hidden={activeTab !== "server-span"}
									>
										{activeTab === "server-span" && (
											<ServerSpanTab serverSpanData={serverSpanData} />
										)}
									</div>
								)}
								<div
									id="request-panel"
									role="tabpanel"
									aria-labelledby="request-tab"
									hidden={activeTab !== "request"}
								>
									{activeTab === "request" && (
										<RequestTab requestData={requestData} />
									)}
								</div>
								<div
									id="response-panel"
									role="tabpanel"
									aria-labelledby="response-tab"
									hidden={activeTab !== "response"}
								>
									{activeTab === "response" && (
										<ResponseTab responseData={responseData} />
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
