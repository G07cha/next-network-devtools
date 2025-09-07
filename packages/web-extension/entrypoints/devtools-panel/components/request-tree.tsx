import { useState } from "react";
import type { RequestSpan, ResponseSpan } from "@/packages/types";
import type { SpanNode } from "../App";

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
