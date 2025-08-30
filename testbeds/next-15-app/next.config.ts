import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	webpack(config) {
		config.ignoreWarnings = [
			...(config.ignoreWarnings ?? []),
			(warning, { requestShortener }) => {
				const isOtelModule =
					!!warning.module &&
					/@opentelemetry\/instrumentation/.test(
						warning.module.readableIdentifier(requestShortener),
					);

				const isCriticalDependencyMessage = /Critical dependency/.test(
					warning.message,
				);

				return isOtelModule && isCriticalDependencyMessage;
			},
		];

		return config;
	},
};

module.exports = nextConfig;
