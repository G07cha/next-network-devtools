import { describe, expect, it } from "vitest";
import { formatDuration } from "../time";

describe("formatDuration", () => {
	describe("milliseconds (< 1000ms)", () => {
		it("should format small durations in milliseconds", () => {
			expect(formatDuration(0)).toBe("0ms");
			expect(formatDuration(1)).toBe("1ms");
			expect(formatDuration(50)).toBe("50ms");
			expect(formatDuration(999)).toBe("999ms");
		});

		it("should round decimal milliseconds", () => {
			expect(formatDuration(0.4)).toBe("0ms");
			expect(formatDuration(0.5)).toBe("1ms");
			expect(formatDuration(999.4)).toBe("999ms");
			expect(formatDuration(999.6)).toBe("1s"); // rounds to 1000ms which becomes 1s
		});
	});

	describe("seconds (1000ms - 59999ms)", () => {
		it("should format durations in seconds", () => {
			expect(formatDuration(1000)).toBe("1s");
			expect(formatDuration(2000)).toBe("2s");
			expect(formatDuration(30000)).toBe("30s");
			expect(formatDuration(59999)).toBe("60s");
		});

		it("should format fractional seconds without trailing zeros", () => {
			expect(formatDuration(1500)).toBe("1.5s");
			expect(formatDuration(1250)).toBe("1.25s");
			expect(formatDuration(1100)).toBe("1.1s");
			expect(formatDuration(1010)).toBe("1.01s");
		});

		it("should not show trailing zeros in seconds", () => {
			expect(formatDuration(2000)).toBe("2s");
			expect(formatDuration(5000)).toBe("5s");
			expect(formatDuration(10000)).toBe("10s");
		});
	});

	describe("minutes (60000ms - 3599999ms)", () => {
		it("should format durations in minutes", () => {
			expect(formatDuration(60000)).toBe("1m");
			expect(formatDuration(120000)).toBe("2m");
			expect(formatDuration(1800000)).toBe("30m");
			expect(formatDuration(3599999)).toBe("60m");
		});

		it("should format fractional minutes without trailing zeros", () => {
			expect(formatDuration(90000)).toBe("1.5m");
			expect(formatDuration(75000)).toBe("1.25m");
			expect(formatDuration(66000)).toBe("1.1m");
			expect(formatDuration(60600)).toBe("1.01m");
		});

		it("should not show trailing zeros in minutes", () => {
			expect(formatDuration(120000)).toBe("2m");
			expect(formatDuration(300000)).toBe("5m");
			expect(formatDuration(600000)).toBe("10m");
		});
	});

	describe("hours (>= 3600000ms)", () => {
		it("should format durations in hours", () => {
			expect(formatDuration(3600000)).toBe("1h");
			expect(formatDuration(7200000)).toBe("2h");
			expect(formatDuration(108000000)).toBe("30h");
		});

		it("should format fractional hours without trailing zeros", () => {
			expect(formatDuration(5400000)).toBe("1.5h");
			expect(formatDuration(4500000)).toBe("1.25h");
			expect(formatDuration(3960000)).toBe("1.1h");
			expect(formatDuration(3636000)).toBe("1.01h");
		});

		it("should not show trailing zeros in hours", () => {
			expect(formatDuration(7200000)).toBe("2h");
			expect(formatDuration(18000000)).toBe("5h");
			expect(formatDuration(36000000)).toBe("10h");
		});
	});
});
