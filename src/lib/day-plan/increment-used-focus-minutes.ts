import type { PrismaClient } from "@prisma/generated";

export type DayPlanDb = Pick<PrismaClient, "dayPlan">;

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

	if (!dayPlan) {
		return null;
	}

	await db.dayPlan.update({
		where: { id: dayPlan.id },
		data: { usedFocusMinutes: { increment: minutes } },
	});

	const updated = await db.dayPlan.findUnique({
		where: { id: dayPlan.id },
	});

	if (updated == null) {
		return null;
	}

	if (updated.usedFocusMinutes > updated.focusBudgetMinutes) {
		const capped = await db.dayPlan.update({
			where: { id: dayPlan.id },
			data: { usedFocusMinutes: updated.focusBudgetMinutes },
		});
		return {
			usedFocusMinutes: capped.usedFocusMinutes,
			focusBudgetMinutes: capped.focusBudgetMinutes,
		};
	}

	return {
		usedFocusMinutes: updated.usedFocusMinutes,
		focusBudgetMinutes: updated.focusBudgetMinutes,
	};
}
