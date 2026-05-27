import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const cycleRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ sessionId: z.number().int().optional() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.cycle.findMany({
				where: {
					userId: ctx.session.user.id,
					...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
				},
				orderBy: { startedAt: "desc" },
			});
		}),

	create: protectedProcedure
		.input(
			z.object({
				sessionId: z.number().int(),
				kind: z.enum(["work", "short_break", "long_break"]),
				configuredDurationSec: z
					.number()
					.int()
					.min(60)
					.max(90 * 60),
				taskId: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify caller owns the session
			const session = await ctx.db.session.findFirst({
				where: { id: input.sessionId, userId: ctx.session.user.id },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			// If taskId provided, verify caller owns the task
			if (input.taskId != null) {
				const task = await ctx.db.task.findFirst({
					where: { id: input.taskId, userId: ctx.session.user.id },
				});

				if (!task) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			try {
				return await ctx.db.cycle.create({
					data: {
						sessionId: input.sessionId,
						userId: ctx.session.user.id,
						kind: input.kind,
						configuredDurationSec: input.configuredDurationSec,
						taskId: input.taskId ?? null,
					},
				});
			} catch (error) {
				if (
					error instanceof Error &&
					"code" in error &&
					(error as { code: string }).code === "P2003"
				) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
				throw error;
			}
		}),
});
