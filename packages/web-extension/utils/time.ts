export const formatDuration = (durationMs: number) => {
	durationMs = Math.round(durationMs);
	if (durationMs < 1000) {
		return `${durationMs}ms`;
	} else if (durationMs < 1000 * 60) {
		return `${Number((durationMs / 1000).toFixed(2))}s`;
	} else if (durationMs < 1000 * 60 * 60) {
		return `${Number((durationMs / (1000 * 60)).toFixed(2))}m`;
	} else {
		return `${Number((durationMs / (1000 * 60 * 60)).toFixed(2))}h`;
	}
};
