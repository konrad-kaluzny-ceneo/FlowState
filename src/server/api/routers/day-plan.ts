import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

const focusBudgetMinutesSchema = z.number().int().min(15).max(720);

export const dayPlanRouter = createTRPCRouter({
	getOrCreate: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await ctx.db.dayPlan.findUnique({
				where: {
					day_plan_user_date_key: {
						userId,
						localDateKey: input.localDateKey,
					},
				},
			});

			if (!existing) {
				return {
					localDateKey: input.localDateKey,
					focusBudgetMinutes: null as number | null,
					usedFocusMinutes: 0,
					remainingFocusMinutes: null as number | null,
				};
			}

			return {
				localDateKey: existing.localDateKey,
				focusBudgetMinutes: existing.focusBudgetMinutes,
				usedFocusMinutes: existing.usedFocusMinutes,
				remainingFocusMinutes: remainingFocusMinutes(
					existing.focusBudgetMinutes,
					existing.usedFocusMinutes,
				),
			};
		}),

	setBudget: protectedProcedure
		.input(
			z.object({
				localDateKey: localDateKeySchema,
				focusBudgetMinutes: focusBudgetMinutesSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const row = await ctx.db.dayPlan.upsert({
				where: {
					day_plan_user_date_key: {
						userId,
						localDateKey: input.localDateKey,
					},
				},
				create: {
					userId,
					localDateKey: input.localDateKey,
					focusBudgetMinutes: input.focusBudgetMinutes,
					usedFocusMinutes: 0,
				},
				update: {
					focusBudgetMinutes: input.focusBudgetMinutes,
				},
			});

			return {
				localDateKey: row.localDateKey,
				focusBudgetMinutes: row.focusBudgetMinutes,
				usedFocusMinutes: row.usedFocusMinutes,
				remainingFocusMinutes: remainingFocusMinutes(
					row.focusBudgetMinutes,
					row.usedFocusMinutes,
				),
			};
		}),

	incrementUsed: protectedProcedure
		.input(
			z.object({
				localDateKey: localDateKeySchema,
				minutes: z.number().int().min(1).max(480),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await ctx.db.dayPlan.findUnique({
				where: {
					day_plan_user_date_key: {
						userId,
						localDateKey: input.localDateKey,
					},
				},
			});

			if (!existing) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Day plan budget not set for this date",
				});
			}

			const usedFocusMinutes = Math.min(
				existing.focusBudgetMinutes,
				existing.usedFocusMinutes + input.minutes,
			);

			const row = await ctx.db.dayPlan.update({
				where: { id: existing.id },
				data: { usedFocusMinutes },
			});

			return {
				localDateKey: row.localDateKey,
				focusBudgetMinutes: row.focusBudgetMinutes,
				usedFocusMinutes: row.usedFocusMinutes,
				remainingFocusMinutes: remainingFocusMinutes(
					row.focusBudgetMinutes,
					row.usedFocusMinutes,
				),
			};
		}),
});
