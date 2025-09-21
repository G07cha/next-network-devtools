import { useState } from "react";
import { Card } from "./card";

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
				</div>
			</button>
			{expanded && <Card className="mt-2">{children}</Card>}
		</div>
	);
}
