import { describe, expect, it } from "vitest";

import {
	computeCycleBreakMinutes,
	computeCycleFocusedMinutes,
} from "~/lib/recap/compute-cycle-focused-minutes";

const baseWork = {
	kind: "WORK",
	state: "COMPLETED",
	configuredDurationSec: 1500,
	startedAt: new Date("2026-06-20T10:00:00Z"),
	endedAt: new Date("2026-06-20T10:20:00Z"),
} as const;

const baseBreak = {
	kind: "SHORT_BREAK",
	state: "COMPLETED",
	configuredDurationSec: 300,
	startedAt: new Date("2026-06-20T10:25:00Z"),
	endedAt: new Date("2026-06-20T10:30:00Z"),
} as const;

describe("computeCycleFocusedMinutes", () => {
	it("returns focused minutes for a completed WORK cycle", () => {
		expect(computeCycleFocusedMinutes(baseWork)).toBe(20);
	});

	it("returns focused minutes for an INTERRUPTED WORK cycle", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				state: "INTERRUPTED",
			}),
		).toBe(20);
	});

	it("caps elapsed at configured duration", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				configuredDurationSec: 600,
				endedAt: new Date("2026-06-20T10:30:00Z"),
			}),
		).toBe(10);
	});

	it("returns at least 1 minute for sub-minute elapsed work", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				endedAt: new Date("2026-06-20T10:00:30Z"),
			}),
		).toBe(1);
	});

	it("returns 0 when endedAt is null", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				endedAt: null,
			}),
		).toBe(0);
	});

	it("returns 0 for break cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				kind: "SHORT_BREAK",
			}),
		).toBe(0);
	});

	it("returns 0 for LONG_BREAK cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				kind: "LONG_BREAK",
			}),
		).toBe(0);
	});

	it("returns 0 for RUNNING cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				state: "RUNNING",
			}),
		).toBe(0);
	});

	it("returns 0 for PAUSED cycles", () => {
		expect(
			computeCycleFocusedMinutes({
				...baseWork,
				state: "PAUSED",
			}),
		).toBe(0);
	});
});

describe("computeCycleBreakMinutes", () => {
	it("returns break minutes for a completed SHORT_BREAK cycle", () => {
		expect(computeCycleBreakMinutes(baseBreak)).toBe(5);
	});

	it("returns break minutes for a completed LONG_BREAK cycle", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				kind: "LONG_BREAK",
				configuredDurationSec: 900,
				endedAt: new Date("2026-06-20T10:40:00Z"),
			}),
		).toBe(15);
	});

	it("returns break minutes for an INTERRUPTED SHORT_BREAK cycle", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				state: "INTERRUPTED",
				endedAt: new Date("2026-06-20T10:27:00Z"),
			}),
		).toBe(2);
	});

	it("returns break minutes for an INTERRUPTED LONG_BREAK cycle", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				kind: "LONG_BREAK",
				state: "INTERRUPTED",
				configuredDurationSec: 900,
				endedAt: new Date("2026-06-20T10:32:00Z"),
			}),
		).toBe(7);
	});

	it("caps elapsed at configured duration", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				configuredDurationSec: 120,
				endedAt: new Date("2026-06-20T10:30:00Z"),
			}),
		).toBe(2);
	});

	it("returns at least 1 minute for sub-minute elapsed break", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				endedAt: new Date("2026-06-20T10:25:20Z"),
			}),
		).toBe(1);
	});

	it("returns 0 for WORK cycles", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				kind: "WORK",
			}),
		).toBe(0);
	});

	it("returns 0 when endedAt is null", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				endedAt: null,
			}),
		).toBe(0);
	});

	it("returns 0 for RUNNING break cycles", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				state: "RUNNING",
			}),
		).toBe(0);
	});

	it("returns 0 for PAUSED break cycles", () => {
		expect(
			computeCycleBreakMinutes({
				...baseBreak,
				state: "PAUSED",
			}),
		).toBe(0);
	});
});
