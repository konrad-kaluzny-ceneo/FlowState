import { describe, expect, it } from "vitest";

import {
	getLongBreakPresets,
	getMaxWorkDurationSec,
	getMinWorkDurationSec,
	getShortBreakPresets,
	getWorkDurationPresets,
	MAX_BREAK_DURATION_SEC,
	MAX_WORK_DURATION_SEC,
	MIN_BREAK_DURATION_SEC,
	MIN_WORK_DURATION_SEC,
} from "./duration-bounds";

describe("duration-bounds", () => {
	it("exposes 1 second minimum and 90 minute maximum for work", () => {
		expect(MIN_WORK_DURATION_SEC).toBe(1);
		expect(MAX_WORK_DURATION_SEC).toBe(90 * 60);
		expect(getMinWorkDurationSec()).toBe(1);
		expect(getMaxWorkDurationSec()).toBe(90 * 60);
	});

	it("exposes 1 second minimum and 30 minute maximum for breaks", () => {
		expect(MIN_BREAK_DURATION_SEC).toBe(1);
		expect(MAX_BREAK_DURATION_SEC).toBe(30 * 60);
	});

	it("returns standard work presets only", () => {
		const presets = getWorkDurationPresets();
		expect(presets.map((p) => p.sec)).toEqual([
			15 * 60,
			25 * 60,
			45 * 60,
			60 * 60,
		]);
		expect(presets.some((p) => p.label.includes("sec"))).toBe(false);
	});

	it("returns short break presets 3, 5, 10 min", () => {
		const presets = getShortBreakPresets();
		expect(presets.map((p) => p.sec)).toEqual([3 * 60, 5 * 60, 10 * 60]);
		expect(presets.every((p) => p.label.endsWith(" min"))).toBe(true);
		expect(presets.some((p) => p.label.includes("sec"))).toBe(false);
	});

	it("returns long break presets 10, 15, 20 min", () => {
		const presets = getLongBreakPresets();
		expect(presets.map((p) => p.sec)).toEqual([10 * 60, 15 * 60, 20 * 60]);
		expect(presets.every((p) => p.label.endsWith(" min"))).toBe(true);
		expect(presets.some((p) => p.label.includes("sec"))).toBe(false);
	});
});
