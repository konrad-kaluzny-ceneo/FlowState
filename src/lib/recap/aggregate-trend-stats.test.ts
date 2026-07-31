import { describe, expect, it } from "vitest";
import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import {
	aggregateTrendStats,
	bucketCyclesByLocalDay,
} from "~/lib/recap/aggregate-trend-stats";
import { getLocalDayBoundaries } from "~/lib/time/local-day-boundary";

const boundaries = getLocalDayBoundaries(3, new Date(2026, 6, 15));

function workCycle(overrides: Partial<CycleRow> = {}): CycleRow {
	return {
		id: 1,
		taskId: 1,
		kind: "WORK",
		state: "COMPLETED",
		configuredDurationSec: 1500,
		startedAt: new Date(2026, 6, 15, 10, 0, 0),
		endedAt: new Date(2026, 6, 15, 10, 25, 0),
		task: { id: 1, status: "active", workType: "DEEP_WORK" },
		...overrides,
	};
}

function breakCycle(overrides: Partial<CycleRow> = {}): CycleRow {
	return {
		id: 2,
		taskId: null,
		kind: "SHORT_BREAK",
		state: "COMPLETED",
		configuredDurationSec: 300,
		startedAt: new Date(2026, 6, 15, 10, 30, 0),
		endedAt: new Date(2026, 6, 15, 10, 35, 0),
		task: null,
		...overrides,
	};
}

describe("bucketCyclesByLocalDay", () => {
	it("buckets a cycle into the day matching its startedAt", () => {
		const cycle = workCycle();
		const buckets = bucketCyclesByLocalDay([cycle], boundaries);

		expect(buckets.get("2026-07-15")).toEqual([cycle]);
		expect(buckets.get("2026-07-14")).toEqual([]);
	});

	it("ignores a cycle whose startedAt falls outside every boundary", () => {
		const cycle = workCycle({ startedAt: new Date(2026, 6, 1, 10, 0, 0) });
		const buckets = bucketCyclesByLocalDay([cycle], boundaries);

		expect(buckets.get("2026-07-15")).toEqual([]);
		expect(buckets.get("2026-07-14")).toEqual([]);
		expect(buckets.get("2026-07-13")).toEqual([]);
	});

	it("does not bucket a cycle by endedAt when startedAt is outside the window", () => {
		// startedAt before the window, endedAt inside it — must NOT count,
		// per plan.md's "Query filter differs from Phase 1 on purpose".
		const cycle = workCycle({
			startedAt: new Date(2026, 6, 1, 23, 55, 0),
			endedAt: new Date(2026, 6, 13, 0, 5, 0),
		});
		const buckets = bucketCyclesByLocalDay([cycle], boundaries);

		expect(buckets.get("2026-07-13")).toEqual([]);
	});
});

describe("aggregateTrendStats", () => {
	it("returns one TrendPoint per boundary in order, zero-filled when empty", () => {
		const points = aggregateTrendStats([], boundaries);

		expect(points).toEqual([
			{
				localDateKey: "2026-07-13",
				focusMinutes: 0,
				breakMinutes: 0,
				switchCount: 0,
			},
			{
				localDateKey: "2026-07-14",
				focusMinutes: 0,
				breakMinutes: 0,
				switchCount: 0,
			},
			{
				localDateKey: "2026-07-15",
				focusMinutes: 0,
				breakMinutes: 0,
				switchCount: 0,
			},
		]);
	});

	it("sums focus and break minutes per day", () => {
		const cycles = [
			workCycle(),
			breakCycle(),
			workCycle({
				id: 3,
				startedAt: new Date(2026, 6, 14, 9, 0, 0),
				endedAt: new Date(2026, 6, 14, 9, 10, 0),
			}),
		];

		const points = aggregateTrendStats(cycles, boundaries);

		expect(points.find((p) => p.localDateKey === "2026-07-15")).toEqual({
			localDateKey: "2026-07-15",
			focusMinutes: 25,
			breakMinutes: 5,
			switchCount: 0,
		});
		expect(points.find((p) => p.localDateKey === "2026-07-14")).toEqual({
			localDateKey: "2026-07-14",
			focusMinutes: 10,
			breakMinutes: 0,
			switchCount: 0,
		});
	});

	it("includes per-day switchCount from countContextSwitches", () => {
		const cycles = [
			workCycle({
				id: 10,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
			}),
			workCycle({
				id: 11,
				taskId: 2,
				startedAt: new Date(2026, 6, 15, 9, 30, 0),
			}),
		];

		const points = aggregateTrendStats(cycles, boundaries);

		expect(
			points.find((p) => p.localDateKey === "2026-07-15")?.switchCount,
		).toBe(1);
	});
});
