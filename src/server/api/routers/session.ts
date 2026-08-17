import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DEFAULT_LIST_LIMIT } from "~/server/api/config";
import { findOrCreateActiveSession } from "~/server/api/lib/active-session";
import { computeSessionEndMetadata } from "~/server/api/lib/session-end-metadata";
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

	getOrCreateActive: protectedProcedure
		.input(
			z
				.object({
					localDateKey: z
						.string()
						.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key")
						.optional(),
					timeZone: z.string().min(1).optional(),
				})
				.optional(),
		)
		.mutation(async ({ ctx, input }) => {
			return findOrCreateActiveSession(ctx.db, ctx.session.user.id, {
				localDateKey: input?.localDateKey,
				timeZone: input?.timeZone,
			});
		}),

	end: protectedProcedure
		.input(
			z.object({
				closureLine: z.string().max(120).optional(),
				lastFocusedTaskId: z.number().int().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const active = await ctx.db.session.findFirst({
				where: {
					userId: ctx.session.user.id,
					state: "ACTIVE",
					archivedAt: null,
				},
			});

			if (active == null) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No active session to end",
				});
			}

			const endedAt = new Date();

			await ctx.db.cycle.updateMany({
				where: {
					userId: ctx.session.user.id,
					sessionId: active.id,
					state: { in: ["RUNNING", "PAUSED"] },
				},
				data: {
					state: "INTERRUPTED",
					endedAt,
					pausedAt: null,
					remainingDurationSec: null,
				},
			});

			const derived = await computeSessionEndMetadata(
				ctx.db,
				ctx.session.user.id,
				active.id,
				"user",
			);

			const lastFocusedTaskId =
				input.lastFocusedTaskId ?? derived.lastFocusedTaskId;

			const { count } = await ctx.db.session.updateMany({
				where: {
					userId: ctx.session.user.id,
					state: "ACTIVE",
					archivedAt: null,
				},
				data: {
					state: "ENDED_BY_USER",
					endedAt,
					closureLine: input.closureLine ?? derived.closureLine,
					lastFocusedTaskId,
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

	getLastEnded: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.session.findFirst({
			where: {
				userId: ctx.session.user.id,
				archivedAt: null,
				endedAt: { not: null },
				state: {
					in: ["ENDED_BY_USER", "ENDED_BY_TIMEOUT", "ENDED_BY_CROSS_DAY"],
				},
			},
			orderBy: { endedAt: "desc" },
		});
	}),
});
