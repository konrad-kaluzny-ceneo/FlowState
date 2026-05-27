import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DEFAULT_LIST_LIMIT } from "~/server/api/config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const checkInRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.checkIn.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { respondedAt: "desc" },
			take: DEFAULT_LIST_LIMIT,
		});
	}),

	create: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				energy: z.enum(["FOCUSED", "STEADY", "FADING"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify caller owns the cycle
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			try {
				return await ctx.db.checkIn.create({
					data: {
						cycleId: input.cycleId,
						userId: ctx.session.user.id,
						energy: input.energy,
					},
				});
			} catch (error) {
				if (
					error instanceof Error &&
					"code" in error &&
					(error as { code: string }).code === "P2002"
				) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "A check-in already exists for this cycle",
					});
				}
				throw error;
			}
		}),
});
