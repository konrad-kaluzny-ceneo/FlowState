import type { Session } from "~/lib/persistence/prisma/client-types";
import { isCrossDayStaleSession } from "~/lib/session/cross-day-stale-session";

import { computeSessionEndMetadata } from "~/server/api/lib/session-end-metadata";
import type { db } from "~/server/db/index";

type Db = typeof db;

export const SESSION_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;

export type ActiveSessionCloseReason = "timeout" | "cross_day";

export { isCrossDayStaleSession };

export async function closeActiveSession(
	database: Db,
	userId: string,
	sessionId: number,
	reason: ActiveSessionCloseReason,
): Promise<void> {
	const sessionState =
		reason === "timeout" ? "ENDED_BY_TIMEOUT" : "ENDED_BY_CROSS_DAY";

	const { closureLine, lastFocusedTaskId } = await computeSessionEndMetadata(
		database,
		userId,
		sessionId,
		reason,
	);

	const endedAt = new Date();

	await database.$transaction([
		database.cycle.updateMany({
			where: {
				sessionId,
				userId,
				state: { in: ["RUNNING", "PAUSED"] },
			},
			data: {
				state: "INTERRUPTED",
				endedAt,
				pausedAt: null,
				remainingDurationSec: null,
			},
		}),
		database.session.updateMany({
			where: { id: sessionId, userId },
			data: {
				state: sessionState,
				endedAt,
				closureLine,
				lastFocusedTaskId,
			},
		}),
	]);
}

export type FindOrCreateActiveSessionOptions = {
	localDateKey?: string;
	timeZone?: string;
};

export async function findOrCreateActiveSession(
	database: Db,
	userId: string,
	options?: FindOrCreateActiveSessionOptions,
): Promise<Session> {
	const activeSessions = await database.session.findMany({
		where: {
			userId,
			state: "ACTIVE",
			archivedAt: null,
		},
		orderBy: { lastActivityAt: "desc" },
	});

	for (const existing of activeSessions) {
		if (
			options?.localDateKey != null &&
			isCrossDayStaleSession(existing, options.localDateKey, {
				timeZone: options.timeZone,
			})
		) {
			await closeActiveSession(database, userId, existing.id, "cross_day");
		}
	}

	const remainingSessions = await database.session.findMany({
		where: {
			userId,
			state: "ACTIVE",
			archivedAt: null,
		},
		orderBy: { lastActivityAt: "desc" },
	});

	const existing = remainingSessions[0];

	if (existing != null) {
		const now = Date.now();
		const lastActivity = existing.lastActivityAt.getTime();

		if (now - lastActivity > SESSION_INACTIVITY_TIMEOUT_MS) {
			await closeActiveSession(database, userId, existing.id, "timeout");

			return database.session.create({
				data: { userId },
			});
		}

		return existing;
	}

	return database.session.create({
		data: { userId },
	});
}
