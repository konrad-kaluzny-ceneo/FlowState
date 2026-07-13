import { describe, expect, it } from "vitest";

import { formatOvertimeMs, formatRemainingMs } from "./format-remaining";

describe("formatRemainingMs", () => {
	it("formats minutes and seconds with zero padding", () => {
		expect(formatRemainingMs(90_000)).toBe("01:30");
		expect(formatRemainingMs(0)).toBe("00:00");
		expect(formatRemainingMs(3_500)).toBe("00:04");
	});

	it("formats negative remaining (overtime) with + prefix", () => {
		expect(formatRemainingMs(-60_000)).toBe("+01:00");
		expect(formatRemainingMs(-1_000)).toBe("+00:01");
		expect(formatRemainingMs(-125_000)).toBe("+02:05");
	});
});

describe("formatOvertimeMs", () => {
	it("formats elapsed overtime with + prefix and zero padding", () => {
		expect(formatOvertimeMs(0)).toBe("+00:00");
		expect(formatOvertimeMs(60_000)).toBe("+01:00");
		expect(formatOvertimeMs(90_000)).toBe("+01:30");
		expect(formatOvertimeMs(5_000)).toBe("+00:05");
	});
});
