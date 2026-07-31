import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import { bucketCyclesByLocalDay } from "~/lib/recap/bucket-cycles-by-local-day";
import type { LocalDayBoundary } from "~/lib/time/local-day-boundary";

export type SwitchCountPoint = {
	localDateKey: string;
	switchCount: number;
};

/**
 * Counts adjacent-pair `taskId` changes among a day's WORK cycles, ordered
 * by `startedAt`. Cycles with a `null` `taskId` are dropped from the
 * sequence *before* counting — so task A -> untracked cycle -> task B still
 * counts as one switch (A->B), matching "did the user change which task
 * they're working on" rather than "did the immediately-previous cycle
 * happen to have a different taskId" (see plan.md Phase 4).
 */
export function countContextSwitches(
	cycles: CycleRow[],
	dayBoundaries: LocalDayBoundary[],
): SwitchCountPoint[] {
	const workCycles = cycles.filter((c) => c.kind === "WORK");
	const buckets = bucketCyclesByLocalDay(workCycles, dayBoundaries);

	return dayBoundaries.map((boundary) => {
		const dayCycles = buckets.get(boundary.localDateKey) ?? [];
		const taskIds = dayCycles
			.slice()
			.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
			.map((c) => c.taskId)
			.filter((taskId): taskId is number => taskId != null);

		let switchCount = 0;
		for (let i = 1; i < taskIds.length; i++) {
			if (taskIds[i] !== taskIds[i - 1]) {
				switchCount += 1;
			}
		}

		return { localDateKey: boundary.localDateKey, switchCount };
	});
}
