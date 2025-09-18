import type { HrTime } from "@opentelemetry/api";

export const hrTimeToMilliseconds = (value: HrTime): number =>
	Math.round(value[0] * 1000 + value[1] / 1e6);
