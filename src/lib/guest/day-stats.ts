import type { GuestCycle, GuestSnapshotV1 } from "~/lib/guest/schema";
import {
	aggregateDayStats,
	type CycleRow,
	type DayStats,
} from "~/lib/recap/aggregate-day-stats";
import {
	aggregateTrendStats,
	type TrendPoint,
} from "~/lib/recap/aggregate-trend-stats";
import {
	getLocalDayBoundaries,
	getLocalDayBoundary,
} from "~/lib/time/local-day-boundary";

function defaultTodayRange(): { start: Date; end: Date } {
	const { start, end } = getLocalDayBoundary();
	return { start, end };
}

/**
 * Adapts guest cycles to CycleRow, mapping guest string taskIds to stable
 * numeric surrogates so CycleRow typing is satisfied without changing the
 * shared interface.
 */
function mapGuestCyclesToCycleRows(
	snapshot: GuestSnapshotV1,
	cycles: GuestCycle[],
): CycleRow[] {
	const taskIdMap = new Map<string, number>();
	let nextNumericId = 1;

	function getNumericTaskId(guestId: string): number {
		const existing = taskIdMap.get(guestId);
		if (existing != null) {
			return existing;
		}
		const id = nextNumericId++;
		taskIdMap.set(guestId, id);
		return id;
	}

	const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));

	return cycles.map((cycle) => {
		const numericTaskId =
			cycle.taskId != null ? getNumericTaskId(cycle.taskId) : null;
		const task = cycle.taskId != null ? taskById.get(cycle.taskId) : null;

		return {
			id: 0, // not used by aggregation
			taskId: numericTaskId,
			kind: cycle.kind,
			state: cycle.state,
			configuredDurationSec: cycle.configuredDurationSec,
			startedAt: cycle.startedAt,
			endedAt: cycle.endedAt,
			task:
				numericTaskId != null && task != null
					? {
							id: numericTaskId,
							status: task.status,
							workType: task.workType,
						}
					: null,
		};
	});
}

/**
 * Aggregates guest snapshot cycles into DayStats, reusing the same
 * aggregateDayStats function used by the authenticated path.
 */
export function buildGuestDayStats(
	snapshot: GuestSnapshotV1,
	range: { start: Date; end: Date } = defaultTodayRange(),
): DayStats {
	// Filter to ended cycles within the requested range
	const windowCycles = snapshot.cycles.filter(
		(cycle) =>
			(cycle.state === "COMPLETED" || cycle.state === "INTERRUPTED") &&
			((cycle.startedAt >= range.start && cycle.startedAt < range.end) ||
				(cycle.endedAt != null &&
					cycle.endedAt >= range.start &&
					cycle.endedAt < range.end)),
	);

	const cycleRows = mapGuestCyclesToCycleRows(snapshot, windowCycles);

	// Count active tasks for undone slice
	const activeCount = snapshot.tasks.filter(
		(t) => t.status === "active" || t.status === "planned",
	).length;

	return aggregateDayStats(cycleRows, activeCount);
}

/**
 * Guest-mode equivalent of `recap.getTrendStats` — bucketed by `startedAt`
 * only, matching the authenticated query's filter shape (see plan.md
 * Critical Implementation Details, "Query filter differs from Phase 1 on
 * purpose").
 */
export function buildGuestTrendStats(
	snapshot: GuestSnapshotV1,
	windowDays: 7 | 30,
	now: Date = new Date(),
): TrendPoint[] {
	const dayBoundaries = getLocalDayBoundaries(windowDays, now);
	const windowStart = dayBoundaries[0]?.start ?? now;
	const windowEnd = dayBoundaries[dayBoundaries.length - 1]?.end ?? now;

	const windowCycles = snapshot.cycles.filter(
		(cycle) =>
			(cycle.state === "COMPLETED" || cycle.state === "INTERRUPTED") &&
			cycle.startedAt >= windowStart &&
			cycle.startedAt < windowEnd,
	);

	const cycleRows = mapGuestCyclesToCycleRows(snapshot, windowCycles);
	return aggregateTrendStats(cycleRows, dayBoundaries);
}
