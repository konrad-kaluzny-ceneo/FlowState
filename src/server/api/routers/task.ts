import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { commitmentHorizonSchema, workTypeSchema } from "~/lib/domain";
import { mapTaskFromPrisma } from "~/lib/persistence/prisma/task-mapper";
import { isStoredPersonaPresetId } from "~/lib/task/persona-presets";
import { archiveStaleTasksForUser } from "~/lib/task/stale-task-archive";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const workTypeSchemaZod = z.enum(workTypeSchema);
const axisSchema = z.number().int().min(1).max(3);
const effortMinutesSchema = z.number().int().min(5).max(240).nullable();
const commitmentHorizonSchemaZod = z.enum(commitmentHorizonSchema);
const resumeNoteSchema = z.string().max(120).nullable().optional();
const personaPresetIdSchema = z.string().max(32).nullable().optional();
const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

async function nextActiveSortOrder(
	db: {
		task: {
			aggregate: (args: {
				where: { userId: string; status: string };
				_max: { sortOrder: true };
			}) => Promise<{ _max: { sortOrder: number | null } }>;
		};
	},
	userId: string,
): Promise<number> {
	const maxResult = await db.task.aggregate({
		where: { userId, status: "active" },
		_max: { sortOrder: true },
	});
	return (maxResult._max.sortOrder ?? -1) + 1;
}

export const taskRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z
				.object({
					localDateKey: localDateKeySchema.optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await archiveStaleTasksForUser(ctx.db, userId);
			const tasks = await ctx.db.task.findMany({
				where: { userId },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			});

			if (input?.localDateKey == null) {
				return tasks.map((task) =>
					mapTaskFromPrisma(task, { doneForToday: false }),
				);
			}

			const completions = await ctx.db.taskDayCompletion.findMany({
				where: {
					userId,
					localDateKey: input.localDateKey,
				},
				select: { taskId: true },
			});
			const doneTodayIds = new Set(completions.map((row) => row.taskId));

			return tasks.map((task) =>
				mapTaskFromPrisma(task, {
					doneForToday: doneTodayIds.has(task.id),
				}),
			);
		}),

	create: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1).max(256),
				workType: workTypeSchemaZod.optional(),
				weight: axisSchema.optional(),
				importance: axisSchema.optional(),
				urgency: axisSchema.optional(),
				effortMinutes: effortMinutesSchema.optional(),
				commitmentHorizon: commitmentHorizonSchemaZod.optional(),
				resumeNote: resumeNoteSchema,
				personaPresetId: personaPresetIdSchema,
				isDailyStanding: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (
				input.personaPresetId != null &&
				!isStoredPersonaPresetId(input.personaPresetId)
			) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			const sortOrder = await nextActiveSortOrder(ctx.db, ctx.session.user.id);
			const urgency = input.urgency ?? input.weight ?? 2;
			const importance = input.importance ?? 2;

			const row = await ctx.db.task.create({
				data: {
					title: input.title,
					userId: ctx.session.user.id,
					sortOrder,
					importance,
					urgency,
					weight: urgency,
					effortMinutes: input.effortMinutes ?? null,
					commitmentHorizon: input.commitmentHorizon ?? "WHEN_POSSIBLE",
					...(input.workType != null ? { workType: input.workType } : {}),
					...(input.resumeNote !== undefined
						? { resumeNote: input.resumeNote }
						: {}),
					...(input.personaPresetId !== undefined
						? { personaPresetId: input.personaPresetId }
						: {}),
					...(input.isDailyStanding != null
						? { isDailyStanding: input.isDailyStanding }
						: {}),
				},
			});
			return mapTaskFromPrisma(row);
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				title: z.string().min(1).max(256).optional(),
				status: z.enum(["active", "completed"]).optional(),
				workType: workTypeSchemaZod.optional(),
				weight: axisSchema.optional(),
				importance: axisSchema.optional(),
				urgency: axisSchema.optional(),
				effortMinutes: effortMinutesSchema.optional(),
				commitmentHorizon: commitmentHorizonSchemaZod.optional(),
				resumeNote: resumeNoteSchema,
				personaPresetId: personaPresetIdSchema,
				isDailyStanding: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (
				input.personaPresetId != null &&
				!isStoredPersonaPresetId(input.personaPresetId)
			) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			const { id, ...data } = input;
			const existing = await ctx.db.task.findFirst({
				where: { id, userId: ctx.session.user.id },
			});

			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			let updateData: typeof data & { sortOrder?: number; urgency?: number } =
				data;

			if (data.urgency != null) {
				updateData = { ...updateData, weight: data.urgency };
			} else if (data.weight != null) {
				updateData = { ...updateData, urgency: data.weight };
			}

			if (data.status === "active" && existing.status === "completed") {
				updateData = {
					...updateData,
					sortOrder: await nextActiveSortOrder(ctx.db, ctx.session.user.id),
				};
			}

			if (data.status === "completed") {
				updateData = { ...updateData, resumeNote: null };
			}

			await ctx.db.task.update({
				where: { id },
				data: updateData,
			});
		}),

	reorder: protectedProcedure
		.input(z.object({ orderedIds: z.array(z.number().int()).min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const activeTasks = await ctx.db.task.findMany({
				where: { userId, status: "active" },
				select: { id: true },
			});

			const activeIds = new Set(activeTasks.map((t) => t.id));

			if (input.orderedIds.length !== activeIds.size) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			const orderedSet = new Set(input.orderedIds);
			if (orderedSet.size !== input.orderedIds.length) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			for (const id of input.orderedIds) {
				if (activeIds.has(id)) {
					continue;
				}

				const task = await ctx.db.task.findFirst({
					where: { id, userId },
				});

				if (!task) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			await ctx.db.$transaction(
				input.orderedIds.map((id, index) =>
					ctx.db.task.update({
						where: { id },
						data: { sortOrder: index },
					}),
				),
			);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.task.findFirst({
				where: { id: input.id, userId: ctx.session.user.id },
			});

			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await ctx.db.task.delete({
				where: { id: input.id },
			});
		}),

	archiveList: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		await archiveStaleTasksForUser(ctx.db, userId);
		const tasks = await ctx.db.task.findMany({
			where: { userId, status: "archived" },
			orderBy: [{ archivedAt: "desc" }, { createdAt: "desc" }],
		});
		return tasks.map((task) => mapTaskFromPrisma(task));
	}),

	restore: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await ctx.db.task.findFirst({
				where: { id: input.id, userId, status: "archived" },
			});

			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const sortOrder = await nextActiveSortOrder(ctx.db, userId);
			const row = await ctx.db.task.update({
				where: { id: input.id },
				data: {
					status: "active",
					archivedAt: null,
					sortOrder,
				},
			});
			return mapTaskFromPrisma(row);
		}),

	deleteArchived: protectedProcedure
		.input(
			z.object({
				ids: z.array(z.number().int()).min(1).max(100),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const rows = await ctx.db.task.findMany({
				where: { userId, id: { in: input.ids } },
				select: { id: true, status: true },
			});

			if (rows.length !== input.ids.length) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			if (rows.some((row) => row.status !== "archived")) {
				throw new TRPCError({ code: "BAD_REQUEST" });
			}

			const { count } = await ctx.db.task.deleteMany({
				where: { userId, id: { in: input.ids }, status: "archived" },
			});

			return { deletedCount: count };
		}),

	markDoneForToday: protectedProcedure
		.input(
			z.object({
				taskId: z.number().int(),
				localDateKey: localDateKeySchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const task = await ctx.db.task.findFirst({
				where: { id: input.taskId, userId, status: "active" },
			});

			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (!task.isDailyStanding) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Task is not marked as daily standing",
				});
			}

			await ctx.db.taskDayCompletion.upsert({
				where: {
					task_day_completion_user_task_date: {
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
