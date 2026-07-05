import type { DayPlanDb } from "~/lib/persistence/prisma/client-types";

/**
 * Atomically adds focus minutes for a user's day plan, capped at budget.
 * No-op when no day plan exists for the date (e.g. budget not set yet).
 */
export async function incrementUsedFocusMinutes(
	db: DayPlanDb,
	userId: string,
	localDateKey: string,
	minutes: number,
): Promise<{ usedFocusMinutes: number; focusBudgetMinutes: number } | null> {
	const dayPlan = await db.dayPlan.findUnique({
		where: {
			day_plan_user_date_key: {
				userId,
				localDateKey,
			},
		},
	});

	// No-op when no day plan exists, or the day plan carries energy only (no
	// budget set yet) — there is nothing to track focus minutes against.
	if (!dayPlan || dayPlan.focusBudgetMinutes == null) {
		return null;
	}

	await db.dayPlan.update({
		where: { id: dayPlan.id },
		data: { usedFocusMinutes: { increment: minutes } },
	});

	const updated = await db.dayPlan.findUnique({
		where: { id: dayPlan.id },
	});

	if (updated == null || updated.focusBudgetMinutes == null) {
		return null;
	}

	const budget = updated.focusBudgetMinutes;

	if (updated.usedFocusMinutes > budget) {
		const capped = await db.dayPlan.update({
			where: { id: dayPlan.id },
			data: { usedFocusMinutes: budget },
		});
		return {
			usedFocusMinutes: capped.usedFocusMinutes,
			focusBudgetMinutes: budget,
		};
	}

	return {
		usedFocusMinutes: updated.usedFocusMinutes,
		focusBudgetMinutes: budget,
	};
}
