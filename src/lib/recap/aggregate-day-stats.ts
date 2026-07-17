/**
 * aggregate-day-stats.ts
 *
 * Derives Podsumowanie KPIs and chart data from raw Cycle + Task rows.
 * All aggregation is today-scoped (rolling 24h window) and purely functional.
 */

import {
	computeCycleBreakMinutes,
	computeCycleFocusedMinutes,
} from "~/lib/recap/compute-cycle-focused-minutes";

// ─── Input types ──────────────────────────────────────────────────────────────

export type CycleRow = {
	id: number;
	taskId: number | null;
	kind: string;
	state: string;
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	task: { id: number; status: string; workType: string } | null;
};

// ─── Output types ─────────────────────────────────────────────────────────────

/** Per-hour bucket for the bar chart (0-23 = hour of day). */
export type HourBucket = {
	hour: number; // 0–23
	focusMinutes: number;
};

/** Work-type breakdown for the session-type donut. */
export type WorkTypeStat = {
	workType: string; // "DEEP_WORK" | "OPERATIONAL" | "REACTIVE" | "uncategorized"
	focusMinutes: number;
	sessionCount: number;
};

/** Task completion breakdown for the tasks donut. */
export type TaskCompletionStat = {
	done: number; // tasks with status "completed"
	partial: number; // tasks with cycles but not completed
	undone: number; // remaining active tasks (passed in)
};

export type DayStats = {
	/** Total tasks with at least one ended WORK cycle today. */
	tasksWithFocusCount: number;
	/** Total tasks whose status is "completed" among focused tasks. */
	doneTasksCount: number;
	/** Total focus minutes (COMPLETED + INTERRUPTED WORK cycles). */
	focusMinutes: number;
	/** Total break minutes (COMPLETED + INTERRUPTED break cycles). */
	breakMinutes: number;
	/** Number of COMPLETED WORK cycles. */
	sessionCount: number;
	/** Average session length in minutes (0 if no sessions). */
	avgSessionMinutes: number;
	/** Per-hour focus distribution (always 24 entries, 0-23). */
	hourBuckets: HourBucket[];
	/** Work-type distribution. */
	workTypeStats: WorkTypeStat[];
	/** Task completion breakdown. */
	taskCompletionStat: TaskCompletionStat;
};

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Aggregates ended WORK and break cycles for today into KPIs and chart data.
 *
 * Focus minutes include COMPLETED and INTERRUPTED WORK cycles.
 * Session count / avg stay COMPLETED-WORK-only.
 * Break minutes sum elapsed from COMPLETED/INTERRUPTED break cycles.
 *
 * @param cycles       Ended cycles (WORK + breaks) from the rolling 24h window.
 * @param activeCount  Number of active (non-completed, non-archived) tasks —
 *                     used to compute the "undone" slice of the tasks donut.
 */
export function aggregateDayStats(
	cycles: CycleRow[],
	activeCount: number,
): DayStats {
	const workCycles = cycles.filter(
		(c) =>
			c.kind === "WORK" &&
			(c.state === "COMPLETED" || c.state === "INTERRUPTED"),
	);

	const completedWorkCycles = workCycles.filter((c) => c.state === "COMPLETED");

	// Initialise 24 hour buckets
	const hourBuckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		focusMinutes: 0,
	}));

	// Accumulators for work-type donut
	const workTypeMap = new Map<
		string,
		{ focusMinutes: number; sessionCount: number }
	>();

	// Task sets for donut
	const focusedTaskIds = new Set<number>();
	const doneTaskIds = new Set<number>();

	let totalFocusMinutes = 0;

	for (const cycle of workCycles) {
		const minutes = computeCycleFocusedMinutes(cycle);
		if (minutes <= 0) {
			continue;
		}

		totalFocusMinutes += minutes;

		// Hour bucket (use startedAt UTC hour to stay timezone-safe)
		const hour = cycle.startedAt.getUTCHours();
		const bucket = hourBuckets[hour];
		if (bucket != null) {
			bucket.focusMinutes += minutes;
		}

		// Work-type donut
		const wt =
			cycle.task?.workType != null ? cycle.task.workType : "uncategorized";
		const existing = workTypeMap.get(wt);
		if (existing == null) {
			workTypeMap.set(wt, { focusMinutes: minutes, sessionCount: 1 });
		} else {
			existing.focusMinutes += minutes;
			existing.sessionCount += 1;
		}

		// Task sets
		if (cycle.taskId != null) {
			focusedTaskIds.add(cycle.taskId);
			if (cycle.task?.status === "completed") {
				doneTaskIds.add(cycle.taskId);
			}
		}
	}

	// Session count derives from COMPLETED WORK only
	const sessionCount = completedWorkCycles.filter((c) => {
		const m = computeCycleFocusedMinutes(c);
		return m > 0;
	}).length;

	const avgSessionMinutes =
		sessionCount > 0
			? Math.round(
					completedWorkCycles.reduce(
						(sum, c) => sum + computeCycleFocusedMinutes(c),
						0,
					) / sessionCount,
				)
			: 0;

	const workTypeStats: WorkTypeStat[] = Array.from(workTypeMap.entries()).map(
		([workType, data]) => ({ workType, ...data }),
	);

	// Sort by focusMinutes desc for legend order
	workTypeStats.sort((a, b) => b.focusMinutes - a.focusMinutes);

	const partialCount = focusedTaskIds.size - doneTaskIds.size;

	const taskCompletionStat: TaskCompletionStat = {
		done: doneTaskIds.size,
		partial: Math.max(0, partialCount),
		undone: Math.max(0, activeCount),
	};

	// Break minutes
	let totalBreakMinutes = 0;
	for (const cycle of cycles) {
		totalBreakMinutes += computeCycleBreakMinutes(cycle);
	}

	return {
		tasksWithFocusCount: focusedTaskIds.size,
		doneTasksCount: doneTaskIds.size,
		focusMinutes: Math.round(totalFocusMinutes),
		breakMinutes: Math.round(totalBreakMinutes),
		sessionCount,
		avgSessionMinutes,
		hourBuckets,
		workTypeStats,
		taskCompletionStat,
	};
}
