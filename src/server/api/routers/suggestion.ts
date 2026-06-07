import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { formatTaskRationale } from "~/lib/scoring/dominant-factor";
import { pickBestTask, type ScoringContext } from "~/lib/scoring/score-task";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

function toTaskWeight(weight: number): 1 | 2 | 3 {
	if (weight === 1 || weight === 2 || weight === 3) {
		return weight;
	}
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Task weight must be 1, 2, or 3",
	});
}

export const suggestionRouter = createTRPCRouter({
	next: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				localHour: z.number().int().min(0).max(23),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
				include: {
					session: true,
					checkIn: true,
				},
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (cycle.checkIn == null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Check-in required before suggestion",
				});
			}

			const activeTasks = await ctx.db.task.findMany({
				where: { userId: ctx.session.user.id, status: "active" },
				orderBy: { createdAt: "asc" },
			});

			if (activeTasks.length === 0) {
				return null;
			}

			const lastOverride = await ctx.db.suggestionDecision.findFirst({
				where: {
					userId: ctx.session.user.id,
					accepted: false,
					cycle: { sessionId: cycle.sessionId },
				},
				orderBy: { createdAt: "desc" },
				include: { chosenTask: true },
			});

			const completedWorkCycles = await ctx.db.cycle.count({
				where: {
					userId: ctx.session.user.id,
					sessionId: cycle.sessionId,
					kind: "WORK",
					state: "COMPLETED",
				},
			});

			const scoringContext: ScoringContext = {
				energy: cycle.checkIn.energy,
				completedWorkCycles,
				interruptionCount: cycle.session.interruptionCount,
				localHour: input.localHour,
				lastOverrideWorkType: lastOverride?.chosenTask.workType,
			};

			const winner = pickBestTask(
				activeTasks.map((t) => ({
					id: t.id,
					workType: t.workType,
					weight: t.weight,
					createdAt: t.createdAt,
				})),
				scoringContext,
			);

			if (winner == null) {
				return null;
			}

			const task = activeTasks.find((t) => t.id === winner.id);
			if (task == null) {
				return null;
			}

			const { rationaleKey, rationale } = formatTaskRationale(
				winner,
				scoringContext,
			);

			return {
				cycleId: cycle.id,
				taskId: task.id,
				title: task.title,
				workType: task.workType,
				weight: toTaskWeight(task.weight),
				rationaleKey,
				rationale,
			};
		}),

	recordDecision: protectedProcedure
		.input(
			z.object({
				cycleId: z.number().int(),
				suggestedTaskId: z.number().int(),
				chosenTaskId: z.number().int(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify caller owns the cycle and suggestion flow completed on a WORK cycle
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
				include: { checkIn: true },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (cycle.kind !== "WORK") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Decisions can only be recorded for work cycles",
				});
			}

			if (cycle.checkIn == null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Check-in required before recording suggestion decision",
				});
			}

			const suggestedTask = await ctx.db.task.findFirst({
				where: {
					id: input.suggestedTaskId,
					userId: ctx.session.user.id,
					status: "active",
				},
			});
			const chosenTask = await ctx.db.task.findFirst({
				where: {
					id: input.chosenTaskId,
					userId: ctx.session.user.id,
					status: "active",
				},
			});

			if (!suggestedTask || !chosenTask) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const accepted = input.suggestedTaskId === input.chosenTaskId;

			try {
				return await ctx.db.suggestionDecision.upsert({
					where: { cycleId: input.cycleId },
					create: {
						userId: ctx.session.user.id,
						cycleId: input.cycleId,
						suggestedTaskId: input.suggestedTaskId,
						chosenTaskId: input.chosenTaskId,
						accepted,
					},
					update: {
						suggestedTaskId: input.suggestedTaskId,
						chosenTaskId: input.chosenTaskId,
						accepted,
					},
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
});
