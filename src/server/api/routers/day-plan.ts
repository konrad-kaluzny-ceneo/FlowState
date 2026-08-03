import type { EnergyLevel } from "@prisma/generated";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";
import { mapTaskFromPrisma } from "~/lib/persistence/prisma/task-mapper";
import {
	type DelegationCandidateTask,
	pickDelegationCandidate,
} from "~/lib/scoring/delegation-score";
import { formatDelegationRationale } from "~/lib/scoring/dominant-factor";
import { buildSuggestionPool } from "~/lib/suggestion/build-suggestion-pool";
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

	getRange: protectedProcedure
		.input(z.object({ localDateKeys: z.array(localDateKeySchema) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const rows = await ctx.db.dayPlan.findMany({
				where: { userId, localDateKey: { in: input.localDateKeys } },
			});

			const budgetByKey = new Map(
				rows.map((row) => [row.localDateKey, row.focusBudgetMinutes]),
			);

			return input.localDateKeys.map((localDateKey) => ({
				localDateKey,
				focusBudgetMinutes: budgetByKey.get(localDateKey) ?? null,
			}));
		}),

	getDelegationSuggestion: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const pool = await buildSuggestionPool(
				ctx.db,
				userId,
				input.localDateKey,
			);

			const skips = await ctx.db.taskDelegationSkip.findMany({
				where: { userId, localDateKey: input.localDateKey },
				select: { taskId: true },
			});
			const skippedIds = new Set(skips.map((row) => row.taskId));

			const candidates: DelegationCandidateTask[] = pool
				.filter((task) => !skippedIds.has(task.id))
				.map((task) => ({
					id: task.id,
					workType: task.workType,
					effortMinutes: task.effortMinutes,
					commitmentHorizon: task.commitmentHorizon,
					importance: task.importance,
					urgency: task.urgency,
					sortOrder: task.sortOrder,
					createdAt: task.createdAt,
				}));

			const winner = pickDelegationCandidate(candidates);

			if (winner == null) {
				return { status: "empty" as const };
			}

			const task = pool.find((t) => t.id === winner.id);
			if (task == null) {
				return { status: "empty" as const };
			}

			const { rationaleKey, rationale } = formatDelegationRationale(winner);

			return {
				status: "ok" as const,
				task: mapTaskFromPrisma(task),
				rationaleKey,
				rationale,
			};
		}),

	skipDelegationSuggestion: protectedProcedure
		.input(
			z.object({
				localDateKey: localDateKeySchema,
				taskId: z.number().int(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const task = await ctx.db.task.findFirst({
				where: { id: input.taskId, userId },
			});

			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await ctx.db.taskDelegationSkip.upsert({
				where: {
					task_delegation_skip_user_task_date: {
						userId,
						taskId: input.taskId,
						localDateKey: input.localDateKey,
					},
				},
				create: {
					userId,
					taskId: input.taskId,
					localDateKey: input.localDateKey,
				},
				update: {},
			});
		}),
});
