import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const taskRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.task.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: protectedProcedure
		.input(z.object({ title: z.string().min(1).max(256) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.task.create({
				data: { title: input.title, userId: ctx.session.user.id },
			});
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number(),
				title: z.string().min(1).max(256).optional(),
				status: z.enum(["active", "completed"]).optional(),
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

			await ctx.db.task.update({
				where: { id },
				data,
			});
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
