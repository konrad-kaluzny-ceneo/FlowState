import type { EnergyLevel } from "~/lib/domain/energy-level";
import {
	buildClosureLine,
	type ClosureLineInput,
} from "~/lib/session/narrative-builder";
import type { db } from "~/server/db/index";

type Db = typeof db;

export type SessionEndMetadata = {
	closureLine: string;
	lastFocusedTaskId: number | null;
};

async function resolveLastFocusedTaskId(
	database: Db,
	userId: string,
	sessionId: number,
): Promise<number | null> {
	const activeWorkCycle = await database.cycle.findFirst({
		where: {
			userId,
			sessionId,
			kind: "WORK",
			state: { in: ["RUNNING", "PAUSED"] },
			taskId: { not: null },
		},
		orderBy: { startedAt: "desc" },
		select: { taskId: true },
	});

	if (activeWorkCycle?.taskId != null) {
		return activeWorkCycle.taskId;
	}

	const lastWorkCycle = await database.cycle.findFirst({
		where: {
			userId,
			sessionId,
			kind: "WORK",
			taskId: { not: null },
		},
		orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
		select: { taskId: true },
	});

	return lastWorkCycle?.taskId ?? null;
}

async function resolveClosureStats(
	database: Db,
	userId: string,
	sessionId: number,
): Promise<Omit<ClosureLineInput, "endedBy">> {
	const [cyclesCompleted, tasksCompleted, checkIn] = await Promise.all([
		database.cycle.count({
			where: {
				userId,
				sessionId,
				kind: "WORK",
				state: "COMPLETED",
			},
		}),
		database.cycle.count({
			where: {
				userId,
				sessionId,
				kind: "WORK",
				state: "COMPLETED",
				task: { status: "completed" },
			},
		}),
		database.checkIn.findFirst({
			where: {
				userId,
				cycle: { sessionId },
			},
			orderBy: { respondedAt: "desc" },
			select: { energy: true },
		}),
	]);

	return {
		cyclesCompleted,
		tasksCompleted,
		latestEnergy: (checkIn?.energy ?? null) as EnergyLevel | null,
	};
}

export async function computeSessionEndMetadata(
	database: Db,
	userId: string,
	sessionId: number,
	endedBy: ClosureLineInput["endedBy"],
): Promise<SessionEndMetadata> {
	const [closureStats, lastFocusedTaskId] = await Promise.all([
		resolveClosureStats(database, userId, sessionId),
		resolveLastFocusedTaskId(database, userId, sessionId),
	]);

	return {
		closureLine: buildClosureLine({ ...closureStats, endedBy }),
		lastFocusedTaskId,
	};
}
