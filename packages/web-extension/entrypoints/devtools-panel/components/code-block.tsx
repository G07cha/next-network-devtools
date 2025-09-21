import { useMemo } from "react";

export interface CodeBlockProps {
	content: string;
	language?: string;
	maxHeight?: string;
}

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
		<pre
			className="text-sm font-mono overflow-auto text-primary"
			style={{ maxHeight }}
		>
			{formattedContent}
		</pre>
	);
}
