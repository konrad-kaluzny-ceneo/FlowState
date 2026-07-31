import type { CycleRow } from "~/lib/recap/aggregate-day-stats";
import type { LocalDayBoundary } from "~/lib/time/local-day-boundary";

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
