import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { energyLevelSchema, type WorkType } from "~/lib/domain";
import type { EnergyLevel } from "~/lib/domain/energy-level";

import {
	formatKickoffRationale,
	formatTaskRationale,
} from "~/lib/scoring/dominant-factor";
import {
	buildPersonaTrustClauseForTask,
	composeSuggestionRationale,
} from "~/lib/scoring/persona-trust-clause";
import { buildRationaleBreakdown } from "~/lib/scoring/rationale-breakdown";
import { pickBestTask, type ScoringContext } from "~/lib/scoring/score-task";
import { resolveIntentionWorkType } from "~/lib/session/narrative-copy";
import {
	buildSuggestionPool,
	loadRemainingFocusMinutes,
} from "~/lib/suggestion/build-suggestion-pool";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { db as dbClient } from "~/server/db/index";

const energyLevelSchemaZod = z.enum(energyLevelSchema);

const localHourSchema = z.number().int().min(0).max(23);
const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

const nextInputSchema = z.discriminatedUnion("context", [
	z.object({
		context: z.literal("post_check_in"),
		cycleId: z.number().int(),
		localHour: localHourSchema,
		localDateKey: localDateKeySchema,
	}),
	z.object({
		context: z.literal("kickoff"),
		sessionId: z.number().int(),
		localHour: localHourSchema,
		localDateKey: localDateKeySchema,
		energy: energyLevelSchemaZod,
		sessionIntention: z.string().max(80).optional(),
	}),
]);

const recordDecisionInputSchema = z.discriminatedUnion("context", [
	z.object({
		context: z.literal("post_check_in"),
		cycleId: z.number().int(),
		suggestedTaskId: z.number().int(),
		chosenTaskId: z.number().int(),
	}),
	z.object({
		context: z.literal("kickoff"),
		sessionId: z.number().int(),
		suggestedTaskId: z.number().int(),
		chosenTaskId: z.number().int(),
	}),
]);

type DbClient = typeof dbClient;

function toTaskWeight(weight: number): 1 | 2 | 3 {
	if (weight === 1 || weight === 2 || weight === 3) {
		return weight;
	}
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Task weight must be 1, 2, or 3",
	});
}

async function buildScoringContextForSession(
	db: DbClient,
	session: { id: number; interruptionCount: number },
	userId: string,
	localHour: number,
	energy: EnergyLevel,
	remainingFocusMinutes: number | null,
	preferredWorkType?: WorkType,
): Promise<ScoringContext> {
	const lastOverride = await db.suggestionDecision.findFirst({
		where: {
			userId,
			accepted: false,
			OR: [
				{ cycle: { sessionId: session.id } },
				{ sessionId: session.id, context: "KICKOFF" },
			],
		},
		orderBy: { createdAt: "desc" },
		include: { chosenTask: true },
	});

	const completedWorkCycles = await db.cycle.count({
		where: {
			userId,
			sessionId: session.id,
			kind: "WORK",
			state: "COMPLETED",
		},
	});

	return {
		energy,
		completedWorkCycles,
		interruptionCount: session.interruptionCount,
		localHour,
		lastOverrideWorkType: lastOverride?.chosenTask.workType,
		preferredWorkType,
		remainingFocusMinutes,
	};
}

async function verifyOwnedTasks(
	db: DbClient,
	userId: string,
	suggestedTaskId: number,
	chosenTaskId: number,
) {
	const suggestedTask = await db.task.findFirst({
		where: {
			id: suggestedTaskId,
			userId,
			status: "active",
		},
	});
	const chosenTask = await db.task.findFirst({
		where: {
			id: chosenTaskId,
			userId,
			status: "active",
		},
	});

	if (!suggestedTask || !chosenTask) {
		throw new TRPCError({ code: "NOT_FOUND" });
	}

	return { suggestedTask, chosenTask };
}

async function applyPersonaTrustToRationale(
	db: DbClient,
	userId: string,
	task: {
		id: number;
		personaPresetId: string | null;
		workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
		urgency: number;
		importance: number;
		commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
		effortMinutes: number | null;
	},
	scoringRationale: string,
): Promise<string> {
	const personaClause = buildPersonaTrustClauseForTask({
		personaPresetId: task.personaPresetId,
		workType: task.workType,
		urgency: task.urgency as 1 | 2 | 3,
		importance: task.importance as 1 | 2 | 3,
		commitmentHorizon: task.commitmentHorizon,
		effortMinutes: task.effortMinutes,
	});
	if (personaClause == null) {
		return scoringRationale;
	}

	const priorSuggestionCount = await db.suggestionDecision.count({
		where: { userId, suggestedTaskId: task.id },
	});
	if (priorSuggestionCount > 0) {
		return scoringRationale;
	}

	return composeSuggestionRationale(scoringRationale, personaClause);
}

export const suggestionRouter = createTRPCRouter({
	next: protectedProcedure
		.input(nextInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			if (input.context === "post_check_in") {
				const cycle = await ctx.db.cycle.findFirst({
					where: { id: input.cycleId, userId },
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

				const activeTasks = await buildSuggestionPool(
					ctx.db,
					userId,
					input.localDateKey,
				);

				if (activeTasks.length === 0) {
					return null;
				}

				const remainingFocusMinutes = await loadRemainingFocusMinutes(
					ctx.db,
					userId,
					input.localDateKey,
				);

				const scoringContext = await buildScoringContextForSession(
					ctx.db,
					cycle.session,
					userId,
					input.localHour,
					cycle.checkIn.energy,
					remainingFocusMinutes,
				);

				const winner = pickBestTask(
					activeTasks.map((t) => ({
						id: t.id,
						workType: t.workType,
						weight: t.weight,
						importance: t.importance,
						urgency: t.urgency,
						effortMinutes: t.effortMinutes,
						commitmentHorizon: t.commitmentHorizon,
						sortOrder: t.sortOrder,
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

				const { rationaleKey, rationale: scoringRationale } =
					formatTaskRationale(winner, scoringContext);

				const rationale = await applyPersonaTrustToRationale(
					ctx.db,
					userId,
					task,
					scoringRationale,
				);

				const breakdown = buildRationaleBreakdown(winner, scoringContext, {
					headline: rationale,
					headlineKey: rationaleKey,
				});

				return {
					cycleId: cycle.id,
					taskId: task.id,
					title: task.title,
					workType: task.workType,
					weight: toTaskWeight(task.weight),
					importance: task.importance,
					urgency: task.urgency,
					effortMinutes: task.effortMinutes,
					commitmentHorizon: task.commitmentHorizon,
					rationaleKey,
					rationale,
					breakdown,
					resumeNote: task.resumeNote,
				};
			}

			const session = await ctx.db.session.findFirst({
				where: { id: input.sessionId, userId },
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (session.state !== "ACTIVE") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session has ended",
				});
			}

			const activeTasks = await buildSuggestionPool(
				ctx.db,
				userId,
				input.localDateKey,
			);

			if (activeTasks.length === 0) {
				return null;
			}

			const remainingFocusMinutes = await loadRemainingFocusMinutes(
				ctx.db,
				userId,
				input.localDateKey,
			);

			const preferredWorkType = resolveIntentionWorkType(
				input.sessionIntention,
			);

			const scoringContext = await buildScoringContextForSession(
				ctx.db,
				session,
				userId,
				input.localHour,
				input.energy,
				remainingFocusMinutes,
				preferredWorkType,
			);

			const winner = pickBestTask(
				activeTasks.map((t) => ({
					id: t.id,
					workType: t.workType,
					weight: t.weight,
					importance: t.importance,
					urgency: t.urgency,
					effortMinutes: t.effortMinutes,
					commitmentHorizon: t.commitmentHorizon,
					sortOrder: t.sortOrder,
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

			const { rationaleKey, rationale: scoringRationale } =
				formatKickoffRationale(winner, scoringContext);

			const rationale = await applyPersonaTrustToRationale(
				ctx.db,
				userId,
				task,
				scoringRationale,
			);

			const breakdown = buildRationaleBreakdown(winner, scoringContext, {
				headline: rationale,
				headlineKey: rationaleKey,
			});

			return {
				sessionId: session.id,
				taskId: task.id,
				title: task.title,
				workType: task.workType,
				weight: toTaskWeight(task.weight),
				importance: task.importance,
				urgency: task.urgency,
				effortMinutes: task.effortMinutes,
				commitmentHorizon: task.commitmentHorizon,
				rationaleKey,
				rationale,
				breakdown,
				resumeNote: task.resumeNote,
			};
		}),

	recordDecision: protectedProcedure
		.input(recordDecisionInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const accepted = input.suggestedTaskId === input.chosenTaskId;

			if (input.context === "kickoff") {
				const session = await ctx.db.session.findFirst({
					where: { id: input.sessionId, userId },
				});

				if (!session) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}

				await verifyOwnedTasks(
					ctx.db,
					userId,
					input.suggestedTaskId,
					input.chosenTaskId,
				);

				try {
					return await ctx.db.suggestionDecision.create({
						data: {
							userId,
							cycleId: null,
							sessionId: input.sessionId,
							context: "KICKOFF",
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
			}

			const cycle = await ctx.db.cycle.findFirst({
				where: { id: input.cycleId, userId },
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

			await verifyOwnedTasks(
				ctx.db,
				userId,
				input.suggestedTaskId,
				input.chosenTaskId,
			);

			try {
				return await ctx.db.suggestionDecision.upsert({
					where: { cycleId: input.cycleId },
					create: {
						userId,
						cycleId: input.cycleId,
						context: "POST_CHECK_IN",
						suggestedTaskId: input.suggestedTaskId,
						chosenTaskId: input.chosenTaskId,
						accepted,
					},
					update: {
						suggestedTaskId: input.suggestedTaskId,
						chosenTaskId: input.chosenTaskId,
						accepted,
						context: "POST_CHECK_IN",
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
