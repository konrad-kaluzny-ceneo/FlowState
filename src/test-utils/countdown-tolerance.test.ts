import { describe, expect, it } from "vitest";

import {
	assertCountdownWithinTolerance,
	expectedCountdownDisplay,
	expectedRemainingSec,
	parseCountdownToSeconds,
} from "~/test-utils/countdown-tolerance";

describe("countdown tolerance helpers", () => {
	it("parses mm:ss countdown text", () => {
		expect(parseCountdownToSeconds("14:30")).toBe(870);
		expect(parseCountdownToSeconds("00:04")).toBe(4);
	});

	it("throws on invalid countdown format", () => {
		expect(() => parseCountdownToSeconds("bad")).toThrow(/Invalid countdown/);
	});

	it("computes expected remaining seconds from end time", () => {
		const now = 1_000_000;
		const endTime = now + 90_500;
		expect(expectedRemainingSec(endTime, now)).toBe(91);
	});

	it("asserts countdown within tolerance using ceil display rule", () => {
		const now = 1_000_000;
		const endTime = now + 90_500;
		const display = expectedCountdownDisplay(endTime, now);
		expect(() =>
			assertCountdownWithinTolerance(display, endTime, 0, now),
		).not.toThrow();
	});
});
