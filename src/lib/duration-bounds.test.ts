import { describe, expect, it } from "vitest";

import {
	getMaxWorkDurationSec,
	getMinWorkDurationSec,
	getWorkDurationPresets,
	MAX_WORK_DURATION_SEC,
	MIN_WORK_DURATION_SEC,
} from "./duration-bounds";

describe("duration-bounds", () => {
	it("exposes 1 second minimum and 90 minute maximum for work", () => {
		expect(MIN_WORK_DURATION_SEC).toBe(1);
		expect(MAX_WORK_DURATION_SEC).toBe(90 * 60);
		expect(getMinWorkDurationSec()).toBe(1);
		expect(getMaxWorkDurationSec()).toBe(90 * 60);
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
});
