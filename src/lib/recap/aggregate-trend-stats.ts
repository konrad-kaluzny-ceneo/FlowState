import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import {
	computeCycleBreakMinutes,
	computeCycleFocusedMinutes,
} from "~/lib/recap/compute-cycle-focused-minutes";
import type { LocalDayBoundary } from "~/lib/time/local-day-boundary";

export type TrendPoint = {
	localDateKey: string;
	focusMinutes: number;
	breakMinutes: number;
};

/**
 * Buckets cycles into their local day by `startedAt` only (a cycle whose
 * `endedAt` lands in a bucket but whose `startedAt` doesn't is not counted —
 * see plan.md Critical Implementation Details, "Query filter differs from
 * Phase 1 on purpose").
 */
export function bucketCyclesByLocalDay(
	cycles: CycleRow[],
	dayBoundaries: LocalDayBoundary[],
): Map<string, CycleRow[]> {
	const buckets = new Map<string, CycleRow[]>();
	for (const boundary of dayBoundaries) {
		buckets.set(boundary.localDateKey, []);
	}

	for (const cycle of cycles) {
		const boundary = dayBoundaries.find(
			(b) => cycle.startedAt >= b.start && cycle.startedAt < b.end,
		);
		if (boundary == null) {
			continue;
		}
		buckets.get(boundary.localDateKey)?.push(cycle);
	}

	return buckets;
}

/** Aggregates focus/break minutes per day across `dayBoundaries`, in order. */
export function aggregateTrendStats(
	cycles: CycleRow[],
	dayBoundaries: LocalDayBoundary[],
): TrendPoint[] {
	const buckets = bucketCyclesByLocalDay(cycles, dayBoundaries);

	return dayBoundaries.map((boundary) => {
		const dayCycles = buckets.get(boundary.localDateKey) ?? [];
		let focusMinutes = 0;
		let breakMinutes = 0;

		for (const cycle of dayCycles) {
			focusMinutes += computeCycleFocusedMinutes(cycle);
			breakMinutes += computeCycleBreakMinutes(cycle);
		}

		return {
			localDateKey: boundary.localDateKey,
			focusMinutes: Math.round(focusMinutes),
			breakMinutes: Math.round(breakMinutes),
		};
	});
}
