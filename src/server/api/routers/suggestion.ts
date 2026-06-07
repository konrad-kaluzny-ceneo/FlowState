import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { formatTaskRationale } from "~/lib/scoring/dominant-factor";
import { pickBestTask, type ScoringContext } from "~/lib/scoring/score-task";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

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
				weight: task.weight as 1 | 2 | 3,
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
			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId: ctx.session.user.id },
			});

			if (!cycle) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const suggestedTask = await ctx.db.task.findFirst({
				where: {
					id: input.suggestedTaskId,
					userId: ctx.session.user.id,
				},
			});
			const chosenTask = await ctx.db.task.findFirst({
				where: {
					id: input.chosenTaskId,
					userId: ctx.session.user.id,
				},
			});

			if (!suggestedTask || !chosenTask) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const accepted = input.suggestedTaskId === input.chosenTaskId;

			return ctx.db.suggestionDecision.upsert({
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
		}),
});
