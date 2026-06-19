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

	if (plan == null) {
		return null;
	}

	return remainingFocusMinutes(plan.focusBudgetMinutes, plan.usedFocusMinutes);
}

export async function buildSuggestionPool(
	db: DbClient,
	userId: string,
	localDateKey: string,
) {
	const completions = await db.taskDayCompletion.findMany({
		where: { userId, localDateKey },
		select: { taskId: true },
	});
	const doneTodayIds = new Set(completions.map((row) => row.taskId));

	const tasks = await db.task.findMany({
		where: {
			userId,
			OR: [{ status: "active" }, { isDailyStanding: true }],
		},
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
	});

	return tasks.filter((task) => {
		if (doneTodayIds.has(task.id)) {
			return false;
		}
		if (task.status === "active") {
			return true;
		}
		return task.isDailyStanding;
	});
}
