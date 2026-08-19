import type { EnergyLevel } from "@prisma/generated";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { remainingFocusMinutes } from "~/lib/day-plan/remaining-focus-minutes";
import { mapTaskFromPrisma } from "~/lib/persistence/prisma/task-mapper";
import {
	gtdFixedContextSchema,
	scheduleBlockTypeSchema,
} from "~/lib/schedule/types";
import {
	type DelegationCandidateTask,
	pickDelegationCandidate,
} from "~/lib/scoring/delegation-score";
import { formatDelegationRationale } from "~/lib/scoring/dominant-factor";
import { buildSuggestionPool } from "~/lib/suggestion/build-suggestion-pool";
import {
	createBlock,
	createContextTag,
	deleteBlock,
	deleteContextTag,
	listBlocksForDay,
	listContextTags,
	MAX_BATCH_TASKS_PER_BLOCK,
	setBlockBatchTasks,
	setBlockFocusTask,
	updateBlock,
} from "~/server/api/lib/schedule-blocks";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

const focusBudgetMinutesSchema = z.number().int().min(15).max(720);

const energySchema = z.enum(["FOCUSED", "STEADY", "FADING"]);

const blockTypeSchema = z.enum(scheduleBlockTypeSchema);
const fixedContextSchema = z.enum(gtdFixedContextSchema);
const blockIdSchema = z.number().int();
const tagIdSchema = z.number().int();
const metaLabelSchema = z.string().max(120).nullable();
const batchTaskIdsSchema = z
	.array(z.number().int())
	.max(MAX_BATCH_TASKS_PER_BLOCK);

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

	listBlocks: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			return listBlocksForDay(ctx.db, ctx.session.user.id, input.localDateKey);
		}),

	createBlock: protectedProcedure
		.input(
			z.object({
				localDateKey: localDateKeySchema,
				blockType: blockTypeSchema,
				startMinute: z.number().int(),
				durationMinutes: z.number().int(),
				metaLabel: metaLabelSchema.optional(),
				fixedContext: fixedContextSchema.nullable().optional(),
				customContextTagId: z.number().int().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return createBlock(ctx.db, ctx.session.user.id, input);
		}),

	updateBlock: protectedProcedure
		.input(
			z.object({
				blockId: blockIdSchema,
				blockType: blockTypeSchema.optional(),
				startMinute: z.number().int().optional(),
				durationMinutes: z.number().int().optional(),
				metaLabel: metaLabelSchema.optional(),
				fixedContext: fixedContextSchema.nullable().optional(),
				customContextTagId: z.number().int().nullable().optional(),
				focusTaskId: z.number().int().nullable().optional(),
				batchTaskIds: batchTaskIdsSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return updateBlock(ctx.db, ctx.session.user.id, input);
		}),

	deleteBlock: protectedProcedure
		.input(z.object({ blockId: blockIdSchema }))
		.mutation(async ({ ctx, input }) => {
			await deleteBlock(ctx.db, ctx.session.user.id, input.blockId);
		}),

	setBlockFocusTask: protectedProcedure
		.input(
			z.object({
				blockId: blockIdSchema,
				taskId: z.number().int().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return setBlockFocusTask(
				ctx.db,
				ctx.session.user.id,
				input.blockId,
				input.taskId,
			);
		}),

	setBlockBatchTasks: protectedProcedure
		.input(
			z.object({
				blockId: blockIdSchema,
				taskIds: batchTaskIdsSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return setBlockBatchTasks(
				ctx.db,
				ctx.session.user.id,
				input.blockId,
				input.taskIds,
			);
		}),

	listContextTags: protectedProcedure.query(async ({ ctx }) => {
		return listContextTags(ctx.db, ctx.session.user.id);
	}),

	createContextTag: protectedProcedure
		.input(z.object({ label: z.string().max(64) }))
		.mutation(async ({ ctx, input }) => {
			return createContextTag(ctx.db, ctx.session.user.id, input.label);
		}),

	deleteContextTag: protectedProcedure
		.input(z.object({ tagId: tagIdSchema }))
		.mutation(async ({ ctx, input }) => {
			await deleteContextTag(ctx.db, ctx.session.user.id, input.tagId);
		}),
});
