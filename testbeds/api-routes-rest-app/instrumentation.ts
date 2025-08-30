export async function register() {
	// Only run in dev mode
	if (
		process.env.NEXT_RUNTIME === "nodejs" &&
		process.env.NODE_ENV === "development"
	) {
		await import("../../packages/nextjs-plugin/src").then(({ register }) => {
			register();
		});
	}
}
