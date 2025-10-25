import { useState } from "react";

interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	defaultExpanded?: boolean;
	badge?: string | number;
	className?: string;
}

export function CollapsibleSection({
	title,
	children,
	defaultExpanded = true,
	className,
}: CollapsibleSectionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div className={className}>
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center justify-between w-full rounded-lg transition-colors p-1"
				aria-expanded={expanded}
			>
				<div className="flex items-center gap-2">
					<span className="text-primary font-medium text-sm">
						{expanded ? "▼" : "▶"}
					</span>
					<span className="font-medium text-sm">{title}</span>
				</div>
			</button>
			{expanded && children}
		</div>
	);
}
