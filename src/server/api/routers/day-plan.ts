import type { EnergyLevel } from "@prisma/generated";
import { z } from "zod";

import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

const focusBudgetMinutesSchema = z.number().int().min(15).max(720);

const energySchema = z.enum(["FOCUSED", "STEADY", "FADING"]);

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
					energyLevel: null as EnergyLevel | null,
				};
			}

			return {
				localDateKey: existing.localDateKey,
				focusBudgetMinutes: existing.focusBudgetMinutes,
				usedFocusMinutes: existing.usedFocusMinutes,
				remainingFocusMinutes:
					existing.focusBudgetMinutes == null
						? null
						: remainingFocusMinutes(
								existing.focusBudgetMinutes,
								existing.usedFocusMinutes,
							),
				energyLevel: existing.energyLevel,
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

			let row = await ctx.db.dayPlan.upsert({
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

			if (
				row.focusBudgetMinutes != null &&
				row.usedFocusMinutes > row.focusBudgetMinutes
			) {
				row = await ctx.db.dayPlan.update({
					where: { id: row.id },
					data: { usedFocusMinutes: row.focusBudgetMinutes },
				});
			}

			return {
				localDateKey: row.localDateKey,
				focusBudgetMinutes: row.focusBudgetMinutes,
				usedFocusMinutes: row.usedFocusMinutes,
				remainingFocusMinutes:
					row.focusBudgetMinutes == null
						? null
						: remainingFocusMinutes(
								row.focusBudgetMinutes,
								row.usedFocusMinutes,
							),
			};
		}),

	setEnergy: protectedProcedure
		.input(
			z.object({
				localDateKey: localDateKeySchema,
				energy: energySchema,
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
					usedFocusMinutes: 0,
					energyLevel: input.energy,
				},
				update: {
					energyLevel: input.energy,
				},
			});

			return {
				localDateKey: row.localDateKey,
				energyLevel: row.energyLevel,
			};
		}),
});
