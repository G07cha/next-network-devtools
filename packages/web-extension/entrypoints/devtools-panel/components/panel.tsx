import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RequestSpan, ResponseSpan } from "@/packages/types";

export interface SidePanelProps {
	requestData?: RequestSpan;
	responseData?: ResponseSpan;
	isOpen: boolean;
	onClose: () => void;
	className?: string;
	isLoading?: boolean;
}

type TabType = "request" | "response";

interface CopyButtonProps {
	content: string;
	label: string;
	className?: string;
}

function CopyButton({ content, label, className = "" }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className={`px-2 py-1 text-xs bg-button hover:bg-gray-600 rounded transition-colors ${className}`}
			title={`Copy ${label}`}
			disabled={!content}
		>
			{copied ? "Copied!" : "Copy"}
		</button>
	);
}

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
				className="flex items-center justify-between w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
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
				<div className="mt-2 p-3 bg-panel rounded-lg border border-gray-700">
					{children}
				</div>
			)}
		</div>
	);
}

interface CodeBlockProps {
	content: string;
	language?: string;
	maxHeight?: string;
}

function CodeBlock({
	content,
	language = "json",
	maxHeight = "300px",
}: CodeBlockProps) {
	const formattedContent = useMemo(() => {
		if (!content) return "";
		try {
			if (language === "json") {
				return JSON.stringify(JSON.parse(content), null, 2);
			}
			return content;
		} catch {
			return content;
		}
	}, [content, language]);

	return (
		<div className="relative">
			<div className="absolute top-2 right-2 z-10">
				<CopyButton content={formattedContent} label="code content" />
			</div>
			<pre
				className="bg-code p-4 rounded-lg text-sm font-mono overflow-auto text-gray-300 border border-gray-600"
				style={{ maxHeight }}
			>
				{formattedContent}
			</pre>
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
		<div className="space-y-2">
			{headerEntries.map(([key, value]) => (
				<div
					key={key}
					className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-gray-800 rounded border border-gray-600"
				>
					<div className="font-medium text-blue text-sm flex-shrink-0 sm:w-48">
						{key}:
					</div>
					<div className="text-gray-300 text-sm font-mono break-all flex-1">
						{value}
					</div>
					<CopyButton content={value} label={key} className="self-start" />
				</div>
			))}
		</div>
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
			<div className="bg-panel p-4 rounded-lg border border-gray-600">
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
				<div className="font-mono text-sm text-gray-300 break-all">
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
				<div className="space-y-2 text-sm">
					<div className="flex justify-between">
						<span className="text-gray-400">Span ID:</span>
						<span className="font-mono text-gray-300">
							{requestData.spanId}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-gray-400">Trace ID:</span>
						<span className="font-mono text-gray-300">
							{requestData.traceId}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-gray-400">Request ID:</span>
						<span className="font-mono text-gray-300">{requestData.id}</span>
					</div>
					{requestData.parentSpan && (
						<div className="flex justify-between">
							<span className="text-gray-400">Parent Span:</span>
							<span className="font-mono text-gray-300">
								{requestData.parentSpan.spanId}
							</span>
						</div>
					)}
				</div>
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
			<div className="bg-panel p-4 rounded-lg border border-gray-600">
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
							{responseTime.toFixed(2)}ms
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
								{responseTime.toFixed(2)}ms
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
	isOpen,
	onClose,
	className = "",
	isLoading = false,
}: SidePanelProps) {
	const [activeTab, setActiveTab] = useState<TabType>("request");
	const [panelWidth, setPanelWidth] = useState(400); // Default width in pixels
	const [isResizing, setIsResizing] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const resizeHandleRef = useRef<HTMLButtonElement>(null);

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

	// Focus trapping
	useEffect(() => {
		if (!isOpen || !panelRef.current) return;

		const panel = panelRef.current;
		const focusableElements = panel.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[
			focusableElements.length - 1
		] as HTMLElement;

		const handleTabKey = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;

			if (event.shiftKey) {
				if (document.activeElement === firstElement) {
					event.preventDefault();
					lastElement?.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					event.preventDefault();
					firstElement?.focus();
				}
			}
		};

		panel.addEventListener("keydown", handleTabKey);
		return () => panel.removeEventListener("keydown", handleTabKey);
	}, [isOpen]);

	const handleTabChange = (tab: TabType) => {
		setActiveTab(tab);
	};

	// Resize functionality
	const handleMouseDown = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			setIsResizing(true);

			const startX = event.clientX;
			const startWidth = panelWidth;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const deltaX = startX - moveEvent.clientX; // Reversed because we're dragging left edge
				const newWidth = Math.max(300, Math.min(800, startWidth + deltaX)); // Min 300px, max 800px
				setPanelWidth(newWidth);
			};

			const handleMouseUp = () => {
				setIsResizing(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[panelWidth],
	);

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
			className="absolute left-15 right-0 top-0 bottom-0 inset-0 z-50 flex items-stretch justify-end"
			role="dialog"
			aria-labelledby="panel-title"
		>
			{/* Panel */}
			<div
				ref={panelRef}
				className={`
					relative bg-dark border-l border-gray-600 shadow-2xl
					h-full overflow-hidden flex
					transform transition-transform duration-300 ease-in-out
					${isOpen ? "translate-x-0" : "translate-x-full"}
					${className}
				`}
				style={{ width: `${panelWidth}px` }}
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
					<div className="flex items-center justify-between p-4 border-b border-gray-600 bg-panel">
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
					<div className="flex border-b border-gray-600 bg-panel">
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
						>
							Request
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
		</div>
	);
}
