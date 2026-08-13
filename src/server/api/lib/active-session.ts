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
	const endedBy = reason === "timeout" ? "timeout" : "cross_day";
	const sessionState =
		reason === "timeout" ? "ENDED_BY_TIMEOUT" : "ENDED_BY_CROSS_DAY";

	const { closureLine, lastFocusedTaskId } = await computeSessionEndMetadata(
		database,
		userId,
		sessionId,
		endedBy,
	);

	await database.cycle.updateMany({
		where: {
			sessionId,
			userId,
			state: { in: ["RUNNING", "PAUSED"] },
		},
		data: {
			state: "INTERRUPTED",
			endedAt: new Date(),
			pausedAt: null,
			remainingDurationSec: null,
		},
	});

	await database.session.update({
		where: { id: sessionId },
		data: {
			state: sessionState,
			endedAt: new Date(),
			closureLine,
			lastFocusedTaskId,
		},
	});
}

export type FindOrCreateActiveSessionOptions = {
	localDateKey?: string;
};

export async function findOrCreateActiveSession(
	database: Db,
	userId: string,
	options?: FindOrCreateActiveSessionOptions,
): Promise<Session> {
	const existing = await database.session.findFirst({
		where: {
			userId,
			state: "ACTIVE",
			archivedAt: null,
		},
	});

	if (existing) {
		if (
			options?.localDateKey != null &&
			isCrossDayStaleSession(existing, options.localDateKey)
		) {
			await closeActiveSession(database, userId, existing.id, "cross_day");

			return database.session.create({
				data: { userId },
			});
		}

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
