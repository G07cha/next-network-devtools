import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	manifest: {
		permissions: ["storage"],
	},
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	hooks: {
		"config:resolved": async (wxt) => {
			// Drop "@" aliases as they are used to reference other packages
			delete wxt.config.alias["@"];
			delete wxt.config.alias["@@"];
		},
	},
	imports: false,
	webExt: {
		startUrls: ["http://localhost:3000"],
		openDevtools: true,
		openConsole: true,
	},
});
