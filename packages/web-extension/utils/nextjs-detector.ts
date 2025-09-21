export interface NextjsDetectionResult {
	isNextjs: boolean;
	isDevelopment: boolean;
	confidence: "high" | "medium" | "low";
	indicators: string[];
}

/**
 * Detects if the current page is a Next.js application in development mode
 */
export function detectNextjs(): NextjsDetectionResult {
	const indicators: string[] = [];
	let isNextjs = false;
	let isDevelopment = false;
	let confidence: "high" | "medium" | "low" = "low";

	// Check for Next.js development-specific scripts
	const scripts = document.querySelectorAll("script[src]");
	for (const script of scripts) {
		const src = (script as HTMLScriptElement).src;

		// Development-only indicators (high confidence)
		if (
			src.includes("_next/webpack-hmr") ||
			src.includes("_next/static/chunks/webpack")
		) {
			indicators.push("webpack-hmr");
			isNextjs = true;
			isDevelopment = true;
			confidence = "high";
		}

		if (src.includes("/_next/static/chunks/") && src.includes("localhost")) {
			indicators.push("dev-chunks");
			isNextjs = true;
			isDevelopment = true;
			confidence = "high";
		}
	}

	// Check for __NEXT_DATA__ script with development indicators
	const nextDataScripts = document.querySelectorAll("script#__NEXT_DATA__");
	for (const script of nextDataScripts) {
		try {
			const data = JSON.parse(script.textContent || "{}");
			indicators.push("__NEXT_DATA__");
			isNextjs = true;

			// Check for development mode indicators in the data
			if (data.buildId === "development" || data.dev === true) {
				indicators.push("dev-build");
				isDevelopment = true;
				confidence = "high";
			}

			// Check for development-specific props or config
			if (data.props?.pageProps?.dev || data.runtimeConfig?.dev) {
				indicators.push("dev-props");
				isDevelopment = true;
				confidence = "high";
			}
		} catch {
			// Invalid JSON, but still indicates Next.js
			indicators.push("__NEXT_DATA__");
			isNextjs = true;
		}
	}

	// Check for Next.js meta tags
	const metaTags = document.querySelectorAll(
		'meta[name="next-head-count"], meta[name="generator"]',
	);
	for (const meta of metaTags) {
		const name = meta.getAttribute("name");
		const content = meta.getAttribute("content");

		if (name === "next-head-count") {
			indicators.push("next-head-count");
			isNextjs = true;
			if (confidence === "low") confidence = "medium";
		}

		if (name === "generator" && content?.includes("Next.js")) {
			indicators.push("next-generator");
			isNextjs = true;
			if (confidence === "low") confidence = "medium";
		}
	}

	// Check URL patterns that suggest development
	const url = window.location.href;
	if (
		url.includes("localhost:3000") ||
		url.includes("localhost:3001") ||
		url.includes("127.0.0.1:3000") ||
		url.includes("127.0.0.1:3001")
	) {
		indicators.push("dev-url");
		if (isNextjs) {
			isDevelopment = true;
			confidence = "high";
		}
	}

	// Check for development-specific DOM elements
	const devIndicators = document.querySelectorAll(
		"[data-nextjs-scroll-focus-boundary]",
	);
	if (devIndicators.length > 0) {
		indicators.push("scroll-boundary");
		isNextjs = true;
		if (confidence === "low") confidence = "medium";
	}

	// Check for Next.js router indicators
	const routerScripts = document.querySelectorAll("script");
	for (const script of routerScripts) {
		if (
			script.textContent?.includes("__NEXT_ROUTER_BASEPATH") ||
			script.textContent?.includes("__NEXT_P")
		) {
			indicators.push("router-indicators");
			isNextjs = true;
			if (confidence === "low") confidence = "medium";
		}
	}

	return {
		isNextjs,
		isDevelopment,
		confidence,
		indicators,
	};
}
