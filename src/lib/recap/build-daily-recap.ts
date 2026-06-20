import { computeCycleFocusedMinutes } from "~/lib/recap/compute-cycle-focused-minutes";
import type {
	DailyRecap,
	RecapTaskId,
	RecapTaskRow,
	TaskFootprint,
	TodayPlanRow,
} from "~/lib/recap/types";
import {
	buildSuggestionPool,
	getDoneTodayTaskIds,
} from "~/lib/suggestion/build-suggestion-pool";
import type { db as dbClient } from "~/server/db/index";

type DbClient = typeof dbClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function buildDailyRecap(
	db: DbClient,
	userId: string,
	localDateKey: string,
	now: Date = new Date(),
): Promise<DailyRecap> {
	const windowStart = new Date(now.getTime() - MS_PER_DAY);

	const cycles = await db.cycle.findMany({
		where: {
			userId,
			kind: "WORK",
			state: "COMPLETED",
			OR: [
				{ startedAt: { gte: windowStart } },
				{ endedAt: { gte: windowStart } },
			],
		},
		include: {
			task: { select: { id: true, title: true } },
		},
		orderBy: { startedAt: "asc" },
	});

	const last24Hours = buildLast24HoursRows(cycles);

	const completedWithoutCycle = await db.task.findMany({
		where: {
			userId,
			status: "completed",
			updatedAt: { gte: windowStart },
		},
		select: { id: true, title: true, updatedAt: true },
	});

	const cycleTaskIds = new Set(
		cycles.map((c) => c.taskId).filter((id): id is number => id != null),
	);

	for (const task of completedWithoutCycle) {
		if (cycleTaskIds.has(task.id)) {
			continue;
		}
		last24Hours.push({
			taskId: task.id,
			title: task.title,
			firstStartedAt: task.updatedAt ?? now,
			lastEndedAt: task.updatedAt ?? now,
			focusedMinutes: 0,
			completedWithoutCycle: true,
		});
	}

	last24Hours.sort((a, b) => b.lastEndedAt.getTime() - a.lastEndedAt.getTime());

	const doneTodayIds = await getDoneTodayTaskIds(db, userId, localDateKey);
	const poolTasks = await buildSuggestionPool(
		db,
		userId,
		localDateKey,
		doneTodayIds,
	);

	const todayPlan: TodayPlanRow[] = poolTasks.map((task) => ({
		taskId: task.id,
		title: task.title,
		isDailyStanding: task.isDailyStanding,
		doneForToday: doneTodayIds.has(task.id),
		effortMinutes: task.effortMinutes,
	}));

	const footprintTaskIds = [
		...new Set([
			...last24Hours.map((row) => row.taskId),
			...todayPlan.map((row) => row.taskId),
		]),
	];

	const footprints = await buildFootprints(db, userId, footprintTaskIds);

	return { last24Hours, todayPlan, footprints };
}

type CycleWithTask = {
	taskId: number | null;
	startedAt: Date;
	endedAt: Date | null;
	kind: string;
	state: string;
	configuredDurationSec: number;
	task: { id: number; title: string } | null;
};

function buildLast24HoursRows(cycles: CycleWithTask[]): RecapTaskRow[] {
	const byTask = new Map<number, RecapTaskRow>();

	for (const cycle of cycles) {
		if (cycle.taskId == null || cycle.task == null) {
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
				title: cycle.task.title,
				firstStartedAt: cycle.startedAt,
				lastEndedAt: cycle.endedAt ?? cycle.startedAt,
				focusedMinutes: minutes,
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
	}

	return [...byTask.values()];
}

async function buildFootprints(
	db: DbClient,
	userId: string,
	taskIds: RecapTaskId[],
): Promise<Record<string, TaskFootprint>> {
	if (taskIds.length === 0) {
		return {};
	}

	const numericTaskIds = taskIds.filter(
		(id): id is number => typeof id === "number",
	);

	if (numericTaskIds.length === 0) {
		return {};
	}

	const cycles = await db.cycle.findMany({
		where: {
			userId,
			kind: "WORK",
			state: "COMPLETED",
			taskId: { in: numericTaskIds },
		},
		select: {
			taskId: true,
			startedAt: true,
			endedAt: true,
			kind: true,
			state: true,
			configuredDurationSec: true,
		},
		orderBy: { startedAt: "asc" },
	});

	const footprints: Record<string, TaskFootprint> = {};

	for (const cycle of cycles) {
		if (cycle.taskId == null) {
			continue;
		}

		const key = String(cycle.taskId);
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
