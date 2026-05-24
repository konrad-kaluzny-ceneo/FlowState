import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tasks } from "~/server/db/schema";

export const taskRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select()
			.from(tasks)
			.where(eq(tasks.userId, ctx.session.user.id))
			.orderBy(tasks.createdAt);
	}),

	create: protectedProcedure
		.input(z.object({ title: z.string().min(1).max(256) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(tasks)
				.values({ title: input.title, userId: ctx.session.user.id });
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
			const result = await ctx.db
				.update(tasks)
				.set(data)
				.where(and(eq(tasks.id, id), eq(tasks.userId, ctx.session.user.id)));

			if (result.rowCount === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			const result = await ctx.db
				.delete(tasks)
				.where(
					and(eq(tasks.id, input.id), eq(tasks.userId, ctx.session.user.id)),
				);

			if (result.rowCount === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
		}),
});
