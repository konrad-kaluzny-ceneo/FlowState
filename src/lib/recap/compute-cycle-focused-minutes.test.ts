import { describe, expect, it } from "vitest";

import { computeCycleFocusedMinutes } from "~/lib/recap/compute-cycle-focused-minutes";

const base = {
	kind: "WORK",
	state: "COMPLETED",
	configuredDurationSec: 1500,
	startedAt: new Date("2026-06-20T10:00:00Z"),
	endedAt: new Date("2026-06-20T10:20:00Z"),
} as const;

describe("computeCycleFocusedMinutes", () => {
	it("returns focused minutes for a completed WORK cycle", () => {
		expect(computeCycleFocusedMinutes(base)).toBe(20);
	});

	it("caps elapsed at configured duration", () => {
		expect(
			computeCycleFocusedMinutes({
				...base,
				configuredDurationSec: 600,
				endedAt: new Date("2026-06-20T10:30:00Z"),
			}),
		).toBe(10);
	});

	it("returns at least 1 minute for sub-minute elapsed work", () => {
		expect(
			computeCycleFocusedMinutes({
				...base,
				endedAt: new Date("2026-06-20T10:00:30Z"),
			}),
		).toBe(1);
	});

	it("returns 0 for INTERRUPTED cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...base,
				state: "INTERRUPTED",
			}),
		).toBe(0);
	});

	it("returns 0 when endedAt is null", () => {
		expect(
			computeCycleFocusedMinutes({
				...base,
				endedAt: null,
			}),
		).toBe(0);
	});

	it("returns 0 for break cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...base,
				kind: "SHORT_BREAK",
			}),
		).toBe(0);
	});
});
