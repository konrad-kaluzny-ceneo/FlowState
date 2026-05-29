import type { Session } from "@prisma/generated";

import type { db } from "~/server/db/index";

type Db = typeof db;

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
		return existing;
	}

	return database.session.create({
		data: { userId },
	});
}
