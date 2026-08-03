import { describe, expect, it } from "vitest";
import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import { countContextSwitches } from "~/lib/recap/count-context-switches";
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

describe("countContextSwitches", () => {
	it("returns zero switches for a single-task day", () => {
		const cycles = [
			workCycle({
				id: 1,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
			}),
			workCycle({
				id: 2,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
			}),
			workCycle({
				id: 3,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 11, 0, 0),
			}),
		];

		const points = countContextSwitches(cycles, boundaries);
		expect(points.find((p) => p.localDateKey === "2026-07-15")).toEqual({
			localDateKey: "2026-07-15",
			switchCount: 0,
		});
	});

	it("counts N-1 switches for N cycles alternating between two tasks", () => {
		const cycles = [
			workCycle({
				id: 1,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
			}),
			workCycle({
				id: 2,
				taskId: 2,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
			}),
			workCycle({
				id: 3,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 11, 0, 0),
			}),
			workCycle({
				id: 4,
				taskId: 2,
				startedAt: new Date(2026, 6, 15, 12, 0, 0),
			}),
		];

		const points = countContextSwitches(cycles, boundaries);
		expect(
			points.find((p) => p.localDateKey === "2026-07-15")?.switchCount,
		).toBe(3);
	});

	it("excludes a null-taskId cycle from the sequence rather than skipping the count at its position", () => {
		// Task A -> untracked cycle -> task B must count as one switch
		// (A -> B), not zero (see plan.md Phase 4).
		const cycles = [
			workCycle({
				id: 1,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
			}),
			workCycle({
				id: 2,
				taskId: null,
				task: null,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
			}),
			workCycle({
				id: 3,
				taskId: 2,
				startedAt: new Date(2026, 6, 15, 11, 0, 0),
			}),
		];

		const points = countContextSwitches(cycles, boundaries);
		expect(
			points.find((p) => p.localDateKey === "2026-07-15")?.switchCount,
		).toBe(1);
	});

	it("ignores break cycles entirely, even when interleaved with a task change", () => {
		const cycles = [
			workCycle({
				id: 1,
				taskId: 1,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
			}),
			breakCycle({ id: 2, startedAt: new Date(2026, 6, 15, 9, 30, 0) }),
			workCycle({
				id: 3,
				taskId: 2,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
			}),
		];

		const points = countContextSwitches(cycles, boundaries);
		expect(
			points.find((p) => p.localDateKey === "2026-07-15")?.switchCount,
		).toBe(1);
	});

	it("returns zero-filled points for an empty cycle list", () => {
		const points = countContextSwitches([], boundaries);
		expect(points).toEqual([
			{ localDateKey: "2026-07-13", switchCount: 0 },
			{ localDateKey: "2026-07-14", switchCount: 0 },
			{ localDateKey: "2026-07-15", switchCount: 0 },
		]);
	});
});
