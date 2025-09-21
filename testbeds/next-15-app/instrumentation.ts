export async function register() {
	// Only run in dev mode
	if (
		process.env.NEXT_RUNTIME === "nodejs" &&
		process.env.NODE_ENV === "development"
	) {
		await import("next-network").then(({ register }) => {
			register();
		});
	}
}
