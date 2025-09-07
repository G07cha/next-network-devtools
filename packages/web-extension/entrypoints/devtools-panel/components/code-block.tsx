import { useMemo } from "react";
import { type CodeBlockProps, CopyButton } from "./panel";

export function CodeBlock({
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
				className="p-4 rounded-lg text-sm font-mono overflow-auto text-primary border border-gray-600"
				style={{ maxHeight }}
			>
				{formattedContent}
			</pre>
		</div>
	);
}
