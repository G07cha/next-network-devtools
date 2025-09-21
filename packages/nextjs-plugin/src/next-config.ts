import type { NextConfig } from "next";

export const withNextNetwork = (nextConfig: NextConfig) => {
	return {
		...nextConfig,
		// biome-ignore lint/suspicious/noExplicitAny: seems to be some variation of webpack config Next.js uses
		webpack: (config: any) => {
			config.ignoreWarnings = [
				...(config.ignoreWarnings ?? []),
				{ module: /require-in-the-middle/ },
			];
			return config;
		},
	};
};
