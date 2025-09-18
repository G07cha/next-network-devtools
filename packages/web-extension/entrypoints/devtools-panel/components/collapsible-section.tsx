import { useState } from "react";

interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	defaultExpanded?: boolean;
	badge?: string | number;
}
export function CollapsibleSection({
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
