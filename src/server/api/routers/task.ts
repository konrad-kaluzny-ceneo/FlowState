import { eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { tasks } from "~/server/db/schema";

export const taskRouter = createTRPCRouter({
	list: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(tasks).orderBy(tasks.createdAt);
	}),

	create: publicProcedure
		.input(z.object({ title: z.string().min(1).max(256) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.insert(tasks).values({ title: input.title });
		}),

	update: publicProcedure
		.input(
			z.object({
				id: z.number(),
				title: z.string().min(1).max(256).optional(),
				status: z.enum(["active", "completed"]).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			await ctx.db.update(tasks).set(data).where(eq(tasks.id, id));
		}),

	delete: publicProcedure
		.input(z.object({ id: z.number() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(tasks).where(eq(tasks.id, input.id));
		}),
});
