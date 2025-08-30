import type { Config } from "tailwindcss";

export default {
	content: [
		"./entrypoints/devtools-panel/**/*.{js,ts,jsx,tsx}",
		"./assets/tailwind.css",
	],
	theme: {
		extend: {},
	},
	plugins: [],
} satisfies Config;
