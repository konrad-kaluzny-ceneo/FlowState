import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import { bucketCyclesByLocalDay } from "~/lib/recap/bucket-cycles-by-local-day";
import {
	computeCycleBreakMinutes,
	computeCycleFocusedMinutes,
} from "~/lib/recap/compute-cycle-focused-minutes";
import { countContextSwitches } from "~/lib/recap/count-context-switches";
import type { LocalDayBoundary } from "~/lib/time/local-day-boundary";

export type TrendPoint = {
	localDateKey: string;
	focusMinutes: number;
	breakMinutes: number;
	switchCount: number;
};

export { bucketCyclesByLocalDay } from "~/lib/recap/bucket-cycles-by-local-day";

/**
 * Aggregates focus/break minutes and context-switch counts per day across
 * `dayBoundaries`, in order.
 */
export function aggregateTrendStats(
	cycles: CycleRow[],
	dayBoundaries: LocalDayBoundary[],
): TrendPoint[] {
	const buckets = bucketCyclesByLocalDay(cycles, dayBoundaries);
	const switchCounts = countContextSwitches(cycles, dayBoundaries);
	const switchCountByDay = new Map(
		switchCounts.map((s) => [s.localDateKey, s.switchCount]),
	);

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
			switchCount: switchCountByDay.get(boundary.localDateKey) ?? 0,
		};
	});
}
