import { TRPCError } from "@trpc/server";
import { DEFAULT_LIST_LIMIT } from "~/server/api/config";
import { findOrCreateActiveSession } from "~/server/api/lib/active-session";
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

	end: protectedProcedure.mutation(async ({ ctx }) => {
		const { count } = await ctx.db.session.updateMany({
			where: {
				userId: ctx.session.user.id,
				state: "ACTIVE",
				archivedAt: null,
			},
			data: {
				state: "ENDED_BY_USER",
				endedAt: new Date(),
			},
		});

		if (count === 0) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "No active session to end",
			});
		}

		const ended = await ctx.db.session.findFirst({
			where: {
				userId: ctx.session.user.id,
				state: "ENDED_BY_USER",
			},
			orderBy: { endedAt: "desc" },
		});

		if (ended == null) {
			throw new TRPCError({ code: "NOT_FOUND" });
		}

		return ended;
	}),
});
