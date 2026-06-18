import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMinWorkDurationSec } from "~/lib/duration-bounds";
import { DEFAULT_LIST_LIMIT } from "~/server/api/config";
import { findOrCreateActiveSession } from "~/server/api/lib/active-session";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const minWorkCycleSec = getMinWorkDurationSec();

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
				take: DEFAULT_LIST_LIMIT,
			});
		}),

	countCompletedWork: protectedProcedure
		.input(z.object({ sessionId: z.number().int() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.cycle.count({
				where: {
					userId: ctx.session.user.id,
					sessionId: input.sessionId,
					kind: "WORK",
					state: "COMPLETED",
				},
			});
		}),

	countTasksCompletedInSession: protectedProcedure
		.input(z.object({ sessionId: z.number().int() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.cycle.count({
				where: {
					userId: ctx.session.user.id,
					sessionId: input.sessionId,
					kind: "WORK",
					state: "COMPLETED",
					task: { status: "completed" },
				},
			});
		}),

	getLatestCheckInEnergy: protectedProcedure
		.input(z.object({ sessionId: z.number().int() }))
		.query(async ({ ctx, input }) => {
			const checkIn = await ctx.db.checkIn.findFirst({
				where: {
					userId: ctx.session.user.id,
					cycle: { sessionId: input.sessionId },
				},
				orderBy: { respondedAt: "desc" },
				select: { energy: true },
			});

			return checkIn?.energy ?? null;
		}),

	getActive: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.cycle.findFirst({
			where: {
				userId: ctx.session.user.id,
				state: { in: ["RUNNING", "PAUSED"] },
			},
			orderBy: { startedAt: "desc" },
			include: { task: true },
		});
	}),

	create: protectedProcedure
		.input(
			z.object({
				sessionId: z.number().int().optional(),
				kind: z.enum(["WORK", "SHORT_BREAK", "LONG_BREAK"]),
				configuredDurationSec: z
					.number()
					.int()
					.min(minWorkCycleSec)
					.max(90 * 60),
				taskId: z.number().int().optional(),
				intention: z.string().max(80).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId =
				input.sessionId ??
				(await findOrCreateActiveSession(ctx.db, ctx.session.user.id)).id;

			const session = await ctx.db.session.findFirst({
				where: { id: sessionId, userId: ctx.session.user.id },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (input.taskId != null) {
				const task = await ctx.db.task.findFirst({
					where: { id: input.taskId, userId: ctx.session.user.id },
				});

				if (!task) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
			}

			try {
				return await ctx.db.$transaction(async (tx) => {
					const existingActive = await tx.cycle.findFirst({
						where: {
							userId: ctx.session.user.id,
							state: { in: ["RUNNING", "PAUSED"] },
						},
					});

					if (existingActive) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "A cycle is already running",
						});
					}

					const cycle = await tx.cycle.create({
						data: {
							sessionId,
							userId: ctx.session.user.id,
							kind: input.kind,
							configuredDurationSec: input.configuredDurationSec,
							taskId: input.taskId ?? null,
							...(input.intention != null
								? { intention: input.intention }
								: {}),
						},
					});

					await tx.session.update({
						where: { id: sessionId },
						data: { lastActivityAt: new Date() },
					});

					return cycle;
				});
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
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

	complete: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				markTaskDone: z.boolean().optional(),
				incrementInterruption: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const endedAt = new Date();

			return ctx.db.$transaction(async (tx) => {
				const { count } = await tx.cycle.updateMany({
					where: {
						id: input.cycleId,
						userId: ctx.session.user.id,
						state: "RUNNING",
					},
					data: { state: "COMPLETED", endedAt },
				});

				if (count === 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Cycle is not running",
					});
				}

				if (input.markTaskDone && cycle.taskId != null) {
					await tx.task.update({
						where: { id: cycle.taskId, userId: ctx.session.user.id },
						data: { status: "completed" },
					});
				}

				await tx.session.update({
					where: { id: cycle.sessionId },
					data: {
						lastActivityAt: new Date(),
						...(input.incrementInterruption
							? { interruptionCount: { increment: 1 } }
							: {}),
					},
				});

				const updated = await tx.cycle.findFirst({
					where: { id: input.cycleId },
				});

				if (!updated) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				return updated;
			});
		}),

	rebindTask: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				taskId: z.number().int(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (cycle.state !== "RUNNING" || cycle.kind !== "WORK") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only a running work cycle can rebind its task",
				});
			}

			const task = await ctx.db.task.findFirst({
				where: { id: input.taskId, userId: ctx.session.user.id },
			});

			if (!task) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return ctx.db.$transaction(async (tx) => {
				const updated = await tx.cycle.updateMany({
					where: {
						id: input.cycleId,
						userId: ctx.session.user.id,
						state: "RUNNING",
						kind: "WORK",
					},
					data: { taskId: input.taskId },
				});

				if (updated.count !== 1) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Only a running work cycle can rebind its task",
					});
				}

				const rebound = await tx.cycle.findFirst({
					where: { id: input.cycleId },
					include: { task: true },
				});

				if (rebound == null) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				await tx.session.update({
					where: { id: cycle.sessionId },
					data: {
						interruptionCount: { increment: 1 },
						lastActivityAt: new Date(),
					},
				});

				return rebound;
			});
		}),

	interrupt: protectedProcedure
		.input(z.object({ cycleId: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const { count } = await ctx.db.cycle.updateMany({
				where: {
					id: input.cycleId,
					userId: ctx.session.user.id,
					state: { in: ["RUNNING", "PAUSED"] },
				},
				data: { state: "INTERRUPTED", endedAt: new Date() },
			});

			if (count === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cycle is not running or paused",
				});
			}

			await ctx.db.session.update({
				where: { id: cycle.sessionId },
				data: { lastActivityAt: new Date() },
			});

			const updated = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId },
			});

			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return updated;
		}),

	pause: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				remainingDurationSec: z.number().int().min(0),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const pausedAt = new Date();

			const { count } = await ctx.db.cycle.updateMany({
				where: {
					id: input.cycleId,
					userId: ctx.session.user.id,
					state: "RUNNING",
				},
				data: {
					state: "PAUSED",
					pausedAt,
					remainingDurationSec: input.remainingDurationSec,
				},
			});

			if (count === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cycle is not running",
				});
			}

			await ctx.db.session.update({
				where: { id: cycle.sessionId },
				data: { lastActivityAt: new Date() },
			});

			const updated = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId },
				include: { task: true },
			});

			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return updated;
		}),

	resume: protectedProcedure
		.input(z.object({ cycleId: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const now = new Date();

			const { count } = await ctx.db.cycle.updateMany({
				where: {
					id: input.cycleId,
					userId: ctx.session.user.id,
					state: "PAUSED",
				},
				data: {
					state: "RUNNING",
					startedAt: now,
					pausedAt: null,
					remainingDurationSec: null,
				},
			});

			if (count === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cycle is not paused",
				});
			}

			await ctx.db.session.update({
				where: { id: cycle.sessionId },
				data: { lastActivityAt: new Date() },
			});

			const updated = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId },
				include: { task: true },
			});

			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return updated;
		}),
});
