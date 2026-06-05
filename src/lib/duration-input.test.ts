import { describe, expect, it } from "vitest";

import { getWorkDurationPresets } from "./duration-bounds";
import {
	combineMinSecToSec,
	findMatchingPreset,
	isDurationSecInRange,
	splitSecToMinSec,
} from "./duration-input";

describe("duration-input", () => {
	describe("splitSecToMinSec", () => {
		it("splits 1500 seconds into 25 min 0 sec", () => {
			expect(splitSecToMinSec(1500)).toEqual({ minutes: 25, seconds: 0 });
		});

		it("splits 30 seconds into 0 min 30 sec", () => {
			expect(splitSecToMinSec(30)).toEqual({ minutes: 0, seconds: 30 });
		});

		it("splits 5400 seconds into 90 min 0 sec", () => {
			expect(splitSecToMinSec(5400)).toEqual({ minutes: 90, seconds: 0 });
		});
	});

	describe("combineMinSecToSec", () => {
		it("combines 0 min 30 sec to 30 seconds", () => {
			expect(combineMinSecToSec(0, 30)).toBe(30);
		});

		it("combines 25 min 0 sec to 1500 seconds", () => {
			expect(combineMinSecToSec(25, 0)).toBe(1500);
		});

		it("combines 90 min 0 sec to 5400 seconds", () => {
			expect(combineMinSecToSec(90, 0)).toBe(5400);
		});
	});

	describe("round-trip", () => {
		it("preserves values through split and combine", () => {
			for (const sec of [1, 30, 45, 1500, 5400]) {
				const { minutes, seconds } = splitSecToMinSec(sec);
				expect(combineMinSecToSec(minutes, seconds)).toBe(sec);
			}
		});
	});

	describe("isDurationSecInRange", () => {
		const minSec = 1;
		const maxSec = 90 * 60;

		it("accepts values within work bounds", () => {
			expect(isDurationSecInRange(1, minSec, maxSec)).toBe(true);
			expect(isDurationSecInRange(30, minSec, maxSec)).toBe(true);
			expect(isDurationSecInRange(5400, minSec, maxSec)).toBe(true);
		});

		it("rejects values outside work bounds", () => {
			expect(isDurationSecInRange(0, minSec, maxSec)).toBe(false);
			expect(isDurationSecInRange(5401, minSec, maxSec)).toBe(false);
		});

		it("rejects 90:01 equivalent (5401 sec)", () => {
			expect(combineMinSecToSec(90, 1)).toBe(5401);
			expect(isDurationSecInRange(5401, minSec, maxSec)).toBe(false);
		});

		it("accepts break bounds 1–1800", () => {
			const breakMin = 1;
			const breakMax = 30 * 60;
			expect(isDurationSecInRange(1, breakMin, breakMax)).toBe(true);
			expect(isDurationSecInRange(1800, breakMin, breakMax)).toBe(true);
			expect(isDurationSecInRange(1801, breakMin, breakMax)).toBe(false);
		});
	});

	describe("findMatchingPreset", () => {
		const presets = getWorkDurationPresets();

		it("finds preset when total matches exactly", () => {
			expect(findMatchingPreset(25 * 60, presets)?.sec).toBe(25 * 60);
		});

		it("returns undefined when no preset matches", () => {
			expect(findMatchingPreset(42 * 60, presets)).toBeUndefined();
		});
	});
});
