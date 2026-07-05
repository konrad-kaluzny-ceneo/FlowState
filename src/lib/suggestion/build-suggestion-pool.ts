import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";
import type { db as dbClient } from "~/server/db/index";

type DbClient = typeof dbClient;

export async function loadRemainingFocusMinutes(
	db: DbClient,
	userId: string,
	localDateKey: string,
): Promise<number | null> {
	const plan = await db.dayPlan.findUnique({
		where: {
			day_plan_user_date_key: {
				userId,
				localDateKey,
			},
		},
	});

	if (plan == null || plan.focusBudgetMinutes == null) {
		return null;
	}

	return remainingFocusMinutes(plan.focusBudgetMinutes, plan.usedFocusMinutes);
}

export async function getDoneTodayTaskIds(
	db: DbClient,
	userId: string,
	localDateKey: string,
): Promise<Set<number>> {
	const completions = await db.taskDayCompletion.findMany({
		where: { userId, localDateKey },
		select: { taskId: true },
	});
	return new Set(completions.map((row) => row.taskId));
}

const SUGGESTION_POOL_STATUSES = ["active", "planned"] as const;

export async function buildSuggestionPool(
	db: DbClient,
	userId: string,
	localDateKey: string,
	doneTodayIds?: Set<number>,
) {
	const resolvedDoneTodayIds =
		doneTodayIds ?? (await getDoneTodayTaskIds(db, userId, localDateKey));

	const tasks = await db.task.findMany({
		where: {
			userId,
			status: { in: [...SUGGESTION_POOL_STATUSES] },
		},
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
	});

	return tasks.filter((task) => !resolvedDoneTodayIds.has(task.id));
}
