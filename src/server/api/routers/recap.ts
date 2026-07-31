import { z } from "zod";
import {
	aggregateDayStats,
	type CycleRow,
} from "~/lib/recap/aggregate-day-stats";
import { aggregateTrendStats } from "~/lib/recap/aggregate-trend-stats";
import { buildDailyRecap } from "~/lib/recap/build-daily-recap";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import type { LocalDayBoundary } from "~/lib/time/local-day-boundary";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Derives `windowDays` day boundaries by subtracting whole-day multiples
 * from the client-supplied `todayLocalMidnightUtc` instant — the server has
 * no real local-timezone context of its own (see plan.md Critical
 * Implementation Details, "DST boundary approximation"). `windowDays` is the
 * *total* bucket count, today included (see "Window inclusivity").
 */
function deriveTrendDayBoundaries(
	todayLocalMidnightUtc: Date,
	windowDays: number,
): LocalDayBoundary[] {
	const boundaries: LocalDayBoundary[] = [];
	for (let i = windowDays - 1; i >= 0; i--) {
		const start = new Date(todayLocalMidnightUtc.getTime() - i * MS_PER_DAY);
		const end = new Date(start.getTime() + MS_PER_DAY);
		boundaries.push({ start, end, localDateKey: formatLocalDateKey(start) });
	}
	return boundaries;
}

export const recapRouter = createTRPCRouter({
	getDaily: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			return buildDailyRecap(ctx.db, ctx.session.user.id, input.localDateKey);
		}),

	getDayStats: protectedProcedure
		.input(z.object({ rangeStart: z.coerce.date(), rangeEnd: z.coerce.date() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { rangeStart, rangeEnd } = input;

			const cycles = await ctx.db.cycle.findMany({
				where: {
					userId,
					state: { in: ["COMPLETED", "INTERRUPTED"] },
					OR: [
						{ startedAt: { gte: rangeStart, lt: rangeEnd } },
						{ endedAt: { gte: rangeStart, lt: rangeEnd } },
					],
				},
				select: {
					id: true,
					taskId: true,
					kind: true,
					state: true,
					configuredDurationSec: true,
					startedAt: true,
					endedAt: true,
					task: {
						select: { id: true, status: true, workType: true },
					},
				},
				orderBy: { startedAt: "asc" },
			});

			// Count active tasks for the "undone" slice
			const activeCount = await ctx.db.task.count({
				where: {
					userId,
					status: { notIn: ["completed", "archived"] },
				},
			});

			return aggregateDayStats(cycles as CycleRow[], activeCount);
		}),

	getTrendStats: protectedProcedure
		.input(
			z.object({
				todayLocalMidnightUtc: z.coerce.date(),
				windowDays: z.union([z.literal(7), z.literal(30)]),
			}),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { todayLocalMidnightUtc, windowDays } = input;

			const dayBoundaries = deriveTrendDayBoundaries(
				todayLocalMidnightUtc,
				windowDays,
			);
			const windowStart = dayBoundaries[0]?.start ?? todayLocalMidnightUtc;
			const windowEnd = new Date(todayLocalMidnightUtc.getTime() + MS_PER_DAY);

			const cycles = await ctx.db.cycle.findMany({
				where: {
					userId,
					state: { in: ["COMPLETED", "INTERRUPTED"] },
					startedAt: { gte: windowStart, lt: windowEnd },
				},
				select: {
					id: true,
					taskId: true,
					kind: true,
					state: true,
					configuredDurationSec: true,
					startedAt: true,
					endedAt: true,
					task: {
						select: { id: true, status: true, workType: true },
					},
				},
				orderBy: { startedAt: "asc" },
			});

			return aggregateTrendStats(cycles as CycleRow[], dayBoundaries);
		}),
});
