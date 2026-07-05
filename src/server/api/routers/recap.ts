import { z } from "zod";
import {
	aggregateDayStats,
	type CycleRow,
} from "~/lib/recap/aggregate-day-stats";
import { buildDailyRecap } from "~/lib/recap/build-daily-recap";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input: { localDateKey: _localDateKey } }) => {
			const userId = ctx.session.user.id;
			const now = new Date();
			const windowStart = new Date(now.getTime() - MS_PER_DAY);

			const cycles = await ctx.db.cycle.findMany({
				where: {
					userId,
					kind: "WORK",
					state: "COMPLETED",
					OR: [
						{ startedAt: { gte: windowStart } },
						{ endedAt: { gte: windowStart } },
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
