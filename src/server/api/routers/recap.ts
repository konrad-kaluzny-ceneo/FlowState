import { z } from "zod";
import {
	aggregateDayStats,
	type CycleRow,
} from "~/lib/recap/aggregate-day-stats";
import { buildDailyRecap } from "~/lib/recap/build-daily-recap";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

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
});
