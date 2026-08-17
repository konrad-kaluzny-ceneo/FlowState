import { describe, expect, it } from "vitest";
import { snapMinute } from "./snap";
import { AXIS_END_MINUTE, AXIS_START_MINUTE } from "./types";

describe("snapMinute", () => {
	it("rounds to the nearest 15-minute mark", () => {
		expect(snapMinute(367)).toBe(360);
		expect(snapMinute(368)).toBe(375);
		expect(snapMinute(540)).toBe(540);
	});

	it("clamps to the 06:00 axis start", () => {
		expect(snapMinute(AXIS_START_MINUTE)).toBe(AXIS_START_MINUTE);
		expect(snapMinute(350)).toBe(AXIS_START_MINUTE);
	});

	it("clamps to the 22:00 axis end", () => {
		expect(snapMinute(AXIS_END_MINUTE)).toBe(AXIS_END_MINUTE);
		expect(snapMinute(1330)).toBe(AXIS_END_MINUTE);
	});
});
