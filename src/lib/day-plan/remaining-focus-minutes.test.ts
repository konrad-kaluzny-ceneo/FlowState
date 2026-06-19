import { describe, expect, it } from "vitest";

import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";

describe("remainingFocusMinutes", () => {
	it("returns budget minus used when under cap", () => {
		expect(remainingFocusMinutes(120, 45)).toBe(75);
	});

	it("never returns negative remaining minutes", () => {
		expect(remainingFocusMinutes(60, 90)).toBe(0);
	});
});
