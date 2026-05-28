import { TRPCError } from "@trpc/server";

import { findOrCreateActiveSession } from "~/server/api/lib/active-session";
import { DEFAULT_LIST_LIMIT } from "~/server/api/config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const sessionRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.session.findMany({
			where: { userId: ctx.session.user.id, archivedAt: null },
			orderBy: { startedAt: "desc" },
			take: DEFAULT_LIST_LIMIT,
		});
	}),

	create: protectedProcedure.mutation(async ({ ctx }) => {
		try {
			return await ctx.db.session.create({
				data: { userId: ctx.session.user.id },
			});
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				(error as { code: string }).code === "P2002"
			) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "An active session already exists",
				});
			}
			throw error;
		}
	}),

	getOrCreateActive: protectedProcedure.mutation(async ({ ctx }) => {
		return findOrCreateActiveSession(ctx.db, ctx.session.user.id);
	}),
});
