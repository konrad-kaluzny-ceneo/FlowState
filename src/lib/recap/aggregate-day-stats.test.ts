import { describe, expect, it } from "vitest";

import {
	aggregateDayStats,
	type CycleRow,
} from "~/lib/recap/aggregate-day-stats";

function makeWorkCycle(
	overrides: Partial<CycleRow> & { minutesDuration: number; startHour: number },
): CycleRow {
	const { minutesDuration, startHour, ...rest } = overrides;
	const startedAt = new Date("2026-07-05T00:00:00Z");
	startedAt.setUTCHours(startHour);
	const endedAt = new Date(startedAt.getTime() + minutesDuration * 60 * 1000);
	return {
		id: rest.id ?? 1,
		taskId: rest.taskId ?? 1,
		kind: rest.kind ?? "WORK",
		state: rest.state ?? "COMPLETED",
		configuredDurationSec: minutesDuration * 60,
		startedAt,
		endedAt,
		task: rest.task ?? { id: 1, status: "active", workType: "DEEP_WORK" },
	};
}

describe("aggregateDayStats", () => {
	it("returns zero stats for empty cycles", () => {
		const result = aggregateDayStats([], 5);
		expect(result.sessionCount).toBe(0);
		expect(result.focusMinutes).toBe(0);
		expect(result.doneTasksCount).toBe(0);
		expect(result.avgSessionMinutes).toBe(0);
		expect(result.hourBuckets).toHaveLength(24);
		expect(result.workTypeStats).toHaveLength(0);
		expect(result.taskCompletionStat.undone).toBe(5);
	});

	it("counts a single completed work cycle", () => {
		const cycle = makeWorkCycle({ minutesDuration: 25, startHour: 10 });
		const result = aggregateDayStats([cycle], 3);

		expect(result.sessionCount).toBe(1);
		expect(result.focusMinutes).toBe(25);
		expect(result.avgSessionMinutes).toBe(25);
	});

	it("bins focus minutes into the correct hour bucket", () => {
		const cycle = makeWorkCycle({ minutesDuration: 25, startHour: 14 });
		const result = aggregateDayStats([cycle], 0);

		const bucket = result.hourBuckets[14];
		expect(bucket?.focusMinutes).toBe(25);

		// All other buckets should be zero
		const others = result.hourBuckets.filter((b) => b.hour !== 14);
		expect(others.every((b) => b.focusMinutes === 0)).toBe(true);
	});

	it("groups cycles by workType correctly", () => {
		const cycles: CycleRow[] = [
			makeWorkCycle({
				id: 1,
				taskId: 1,
				minutesDuration: 25,
				startHour: 9,
				task: { id: 1, status: "active", workType: "DEEP_WORK" },
			}),
			makeWorkCycle({
				id: 2,
				taskId: 2,
				minutesDuration: 15,
				startHour: 11,
				task: { id: 2, status: "active", workType: "OPERATIONAL" },
			}),
			makeWorkCycle({
				id: 3,
				taskId: 1,
				minutesDuration: 10,
				startHour: 13,
				task: { id: 1, status: "active", workType: "DEEP_WORK" },
			}),
		];

		const result = aggregateDayStats(cycles, 0);
		const deepWork = result.workTypeStats.find(
			(w) => w.workType === "DEEP_WORK",
		);
		const operational = result.workTypeStats.find(
			(w) => w.workType === "OPERATIONAL",
		);

		expect(deepWork?.focusMinutes).toBe(35);
		expect(deepWork?.sessionCount).toBe(2);
		expect(operational?.focusMinutes).toBe(15);
		expect(operational?.sessionCount).toBe(1);
	});

	it("handles uncategorized cycles (no task)", () => {
		const cycle: CycleRow = {
			id: 1,
			taskId: null,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 25 * 60,
			startedAt: new Date("2026-07-05T10:00:00Z"),
			endedAt: new Date("2026-07-05T10:25:00Z"),
			task: null,
		};

		const result = aggregateDayStats([cycle], 0);
		const uncategorized = result.workTypeStats.find(
			(w) => w.workType === "uncategorized",
		);
		expect(uncategorized?.focusMinutes).toBe(25);
	});

	it("correctly splits done vs partial vs undone tasks", () => {
		const cycles: CycleRow[] = [
			// done task (id=1, status=completed)
			makeWorkCycle({
				id: 1,
				taskId: 1,
				minutesDuration: 25,
				startHour: 9,
				task: { id: 1, status: "completed", workType: "DEEP_WORK" },
			}),
			// partial task (id=2, status=active — has cycles but not completed)
			makeWorkCycle({
				id: 2,
				taskId: 2,
				minutesDuration: 15,
				startHour: 10,
				task: { id: 2, status: "active", workType: "OPERATIONAL" },
			}),
		];

		const result = aggregateDayStats(cycles, 3); // 3 additional undone tasks

		expect(result.taskCompletionStat.done).toBe(1);
		expect(result.taskCompletionStat.partial).toBe(1);
		expect(result.taskCompletionStat.undone).toBe(3);
	});

	it("ignores non-WORK and non-COMPLETED cycles", () => {
		const cycles: CycleRow[] = [
			{
				id: 1,
				taskId: 1,
				kind: "SHORT_BREAK",
				state: "COMPLETED",
				configuredDurationSec: 300,
				startedAt: new Date("2026-07-05T10:00:00Z"),
				endedAt: new Date("2026-07-05T10:05:00Z"),
				task: { id: 1, status: "active", workType: "DEEP_WORK" },
			},
			{
				id: 2,
				taskId: 2,
				kind: "WORK",
				state: "INTERRUPTED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-07-05T11:00:00Z"),
				endedAt: new Date("2026-07-05T11:10:00Z"),
				task: { id: 2, status: "active", workType: "OPERATIONAL" },
			},
		];

		const result = aggregateDayStats(cycles, 0);
		expect(result.sessionCount).toBe(0);
		expect(result.focusMinutes).toBe(0);
	});

	it("computes correct average session length", () => {
		const cycles: CycleRow[] = [
			makeWorkCycle({ id: 1, taskId: 1, minutesDuration: 20, startHour: 9 }),
			makeWorkCycle({ id: 2, taskId: 2, minutesDuration: 30, startHour: 10 }),
		];

		const result = aggregateDayStats(cycles, 0);
		// total = 50 min / 2 sessions = 25 avg
		expect(result.avgSessionMinutes).toBe(25);
	});

	it("a planned+isDailyStanding task with active status does not enter done count", () => {
		// This guards the invariant from Phase 4: planned daily-standing tasks are
		// created active, so they won't slip into done unless explicitly completed.
		const cycle = makeWorkCycle({
			minutesDuration: 25,
			startHour: 9,
			task: { id: 1, status: "active", workType: "DEEP_WORK" },
		});
		const result = aggregateDayStats([cycle], 0);
		expect(result.doneTasksCount).toBe(0);
		expect(result.taskCompletionStat.partial).toBe(1);
	});
});
