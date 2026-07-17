import type { GuestSnapshotV1 } from "~/lib/guest/schema";
import {
	aggregateDayStats,
	type CycleRow,
	type DayStats,
} from "~/lib/recap/aggregate-day-stats";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Aggregates guest snapshot cycles into DayStats, reusing the same
 * aggregateDayStats function used by the authenticated path.
 *
 * Maps guest string taskIds to stable numeric surrogates so CycleRow typing
 * is satisfied without changing the shared interface.
 */
export function buildGuestDayStats(
	snapshot: GuestSnapshotV1,
	now: Date = new Date(),
): DayStats {
	const windowStart = new Date(now.getTime() - MS_PER_DAY);

	// Filter to ended cycles within the rolling 24h window
	const windowCycles = snapshot.cycles.filter(
		(cycle) =>
			(cycle.state === "COMPLETED" || cycle.state === "INTERRUPTED") &&
			(cycle.startedAt >= windowStart ||
				(cycle.endedAt != null && cycle.endedAt >= windowStart)),
	);

	// Map guest string taskIds to stable numeric surrogates
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

	// Build task lookup
	const taskById = new Map(snapshot.tasks.map((t) => [t.id, t]));

	// Adapt guest cycles to CycleRow
	const cycleRows: CycleRow[] = windowCycles.map((cycle) => {
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

	// Count active tasks for undone slice
	const activeCount = snapshot.tasks.filter(
		(t) => t.status === "active" || t.status === "planned",
	).length;

	return aggregateDayStats(cycleRows, activeCount);
}
