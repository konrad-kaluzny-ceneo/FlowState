import type { Session } from "@prisma/generated";

import type { db } from "~/server/db/index";

type Db = typeof db;

export const SESSION_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000;

export async function findOrCreateActiveSession(
	database: Db,
	userId: string,
): Promise<Session> {
	const existing = await database.session.findFirst({
		where: {
			userId,
			state: "ACTIVE",
			archivedAt: null,
		},
	});

	if (existing) {
		const now = Date.now();
		const lastActivity = existing.lastActivityAt.getTime();

		if (now - lastActivity > SESSION_INACTIVITY_TIMEOUT_MS) {
			await database.session.update({
				where: { id: existing.id },
				data: {
					state: "ENDED_BY_TIMEOUT",
					endedAt: new Date(),
				},
			});

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
