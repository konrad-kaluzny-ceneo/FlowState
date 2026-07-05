import type {
	GuestCycle,
	GuestSnapshotV1,
	GuestTask,
} from "~/lib/guest/schema";
import { computeCycleFocusedMinutes } from "~/lib/recap/compute-cycle-focused-minutes";
import type {
	DailyRecap,
	RecapTaskRow,
	TaskFootprint,
	TodayPlanRow,
} from "~/lib/recap/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildGuestDailyRecap(
	snapshot: GuestSnapshotV1,
	_localDateKey: string,
	doneTodayIds: ReadonlySet<string>,
	now: Date = new Date(),
): DailyRecap {
	const windowStart = new Date(now.getTime() - MS_PER_DAY);

	const cycles = snapshot.cycles.filter(
		(cycle) =>
			cycle.kind === "WORK" &&
			cycle.state === "COMPLETED" &&
			(cycle.startedAt >= windowStart ||
				(cycle.endedAt != null && cycle.endedAt >= windowStart)),
	);

	const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));
	const last24Hours = buildGuestLast24HoursRows(cycles, taskById);

	const cycleTaskIds = new Set(
		cycles
			.map((cycle) => cycle.taskId)
			.filter((id): id is string => id != null),
	);

	for (const task of snapshot.tasks) {
		if (task.status !== "completed" || task.updatedAt == null) {
			continue;
		}
		if (task.updatedAt < windowStart || cycleTaskIds.has(task.id)) {
			continue;
		}
		last24Hours.push({
			taskId: task.id,
			title: task.title,
			firstStartedAt: task.updatedAt,
			lastEndedAt: task.updatedAt,
			focusedMinutes: 0,
			workType: task.workType,
			effortMinutes: task.effortMinutes ?? null,
			isCompleted: true,
			completedWithoutCycle: true,
		});
	}

	last24Hours.sort((a, b) => b.lastEndedAt.getTime() - a.lastEndedAt.getTime());

	const poolTasks = buildGuestSuggestionPool(snapshot.tasks, doneTodayIds);
	const todayPlan: TodayPlanRow[] = poolTasks.map((task) => ({
		taskId: task.id,
		title: task.title,
		isDailyStanding: task.isDailyStanding ?? false,
		doneForToday: doneTodayIds.has(task.id),
		effortMinutes: task.effortMinutes,
	}));

	const footprintTaskIds = [
		...new Set([
			...last24Hours.map((row) => String(row.taskId)),
			...todayPlan.map((row) => String(row.taskId)),
		]),
	];

	const footprints = buildGuestFootprints(snapshot.cycles, footprintTaskIds);

	return { last24Hours, todayPlan, footprints };
}

function buildGuestSuggestionPool(
	tasks: GuestTask[],
	doneTodayIds: ReadonlySet<string>,
): GuestTask[] {
	return tasks
		.filter(
			(task) =>
				(task.status === "active" || task.status === "planned") &&
				!doneTodayIds.has(task.id),
		)
		.sort((a, b) => {
			if (a.sortOrder !== b.sortOrder) {
				return a.sortOrder - b.sortOrder;
			}
			return a.createdAt.getTime() - b.createdAt.getTime();
		});
}

function buildGuestLast24HoursRows(
	cycles: GuestCycle[],
	taskById: Map<string, GuestTask>,
): RecapTaskRow[] {
	const byTask = new Map<string, RecapTaskRow>();

	for (const cycle of cycles) {
		if (cycle.taskId == null) {
			continue;
		}
		const task = taskById.get(cycle.taskId);
		if (task == null) {
			continue;
		}

		const minutes = computeCycleFocusedMinutes(cycle);
		if (minutes <= 0) {
			continue;
		}
		const existing = byTask.get(cycle.taskId);

		if (existing == null) {
			byTask.set(cycle.taskId, {
				taskId: cycle.taskId,
				title: task.title,
				firstStartedAt: cycle.startedAt,
				lastEndedAt: cycle.endedAt ?? cycle.startedAt,
				focusedMinutes: minutes,
				workType: task.workType,
				effortMinutes: task.effortMinutes ?? null,
				isCompleted: task.status === "completed",
			});
			continue;
		}

		if (cycle.startedAt < existing.firstStartedAt) {
			existing.firstStartedAt = cycle.startedAt;
		}
		const endedAt = cycle.endedAt ?? cycle.startedAt;
		if (endedAt > existing.lastEndedAt) {
			existing.lastEndedAt = endedAt;
		}
		existing.focusedMinutes += minutes;
		if (task.status === "completed") {
			existing.isCompleted = true;
		}
	}

	return [...byTask.values()];
}

function buildGuestFootprints(
	cycles: GuestCycle[],
	taskIds: string[],
): Record<string, TaskFootprint> {
	if (taskIds.length === 0) {
		return {};
	}

	const allowed = new Set(taskIds);
	const footprints: Record<string, TaskFootprint> = {};

	for (const cycle of cycles) {
		if (
			cycle.kind !== "WORK" ||
			cycle.state !== "COMPLETED" ||
			cycle.taskId == null ||
			!allowed.has(cycle.taskId)
		) {
			continue;
		}

		const key = cycle.taskId;
		const minutes = computeCycleFocusedMinutes(cycle);
		if (minutes <= 0) {
			continue;
		}
		const endedAt = cycle.endedAt ?? cycle.startedAt;
		const existing = footprints[key];

		if (existing == null) {
			footprints[key] = {
				lastFocusedAt: endedAt,
				cumulativeMinutes: minutes,
			};
			continue;
		}

		if (endedAt > existing.lastFocusedAt) {
			existing.lastFocusedAt = endedAt;
		}
		existing.cumulativeMinutes += minutes;
	}

	return footprints;
}
