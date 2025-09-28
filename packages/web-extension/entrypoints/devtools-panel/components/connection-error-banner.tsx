export const ConnectionErrorBanner = () => (
	<div className="bg-error-bg border-b border-error-border text-error px-4 py-3 text-sm">
		<p className="font-medium">Connection Error</p>
		<p className="mt-1">
			Cannot connect to Next Network instrumentation server. Please make sure
			you have installed the Next.js plugin in your application.
		</p>
		<p className="mt-2">
			Visit the{" "}
			<a
				href="https://github.com/G07cha/next-network-devtools?tab=readme-ov-file#getting-started"
				target="_blank"
				rel="noopener noreferrer"
				className="text-info hover:text-info-light underline"
			>
				Getting Started Guide
			</a>{" "}
			for installation instructions.
		</p>
	</div>
);
