import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const workTypeSchema = z.enum(["DEEP_WORK", "OPERATIONAL", "REACTIVE"]);
const axisSchema = z.number().int().min(1).max(3);
const effortMinutesSchema = z.number().int().min(5).max(240).nullable();
const commitmentHorizonSchema = z.enum(["ASAP", "THIS_WEEK", "WHEN_POSSIBLE"]);

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
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.task.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		});
	}),

	create: protectedProcedure
		.input(
			z.object({
				title: z.string().min(1).max(256),
				workType: workTypeSchema.optional(),
				weight: axisSchema.optional(),
				importance: axisSchema.optional(),
				urgency: axisSchema.optional(),
				effortMinutes: effortMinutesSchema.optional(),
				commitmentHorizon: commitmentHorizonSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sortOrder = await nextActiveSortOrder(ctx.db, ctx.session.user.id);
			const urgency = input.urgency ?? input.weight ?? 2;
			const importance = input.importance ?? 2;

			return await ctx.db.task.create({
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
				},
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				title: z.string().min(1).max(256).optional(),
				status: z.enum(["active", "completed"]).optional(),
				workType: workTypeSchema.optional(),
				weight: axisSchema.optional(),
				importance: axisSchema.optional(),
				urgency: axisSchema.optional(),
				effortMinutes: effortMinutesSchema.optional(),
				commitmentHorizon: commitmentHorizonSchema.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
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
});
