export const STALE_TASK_ARCHIVE_DAYS = 3;

export function getStaleArchiveCutoff(now: Date): Date {
	const cutoff = new Date(now);
	cutoff.setDate(cutoff.getDate() - STALE_TASK_ARCHIVE_DAYS);
	return cutoff;
}

export function getTaskTouchAnchor(task: {
	updatedAt: Date | null;
	createdAt: Date;
}): Date {
	return task.updatedAt ?? task.createdAt;
}

export function matchesStaleArchivePredicate(
	task: {
		status: string;
		isDailyStanding: boolean;
		updatedAt: Date | null;
		createdAt: Date;
	},
	cutoff: Date,
): boolean {
	if (task.status !== "active" || task.isDailyStanding) {
		return false;
	}
	return getTaskTouchAnchor(task) <= cutoff;
}

export function buildStaleArchiveUpdateWhere(userId: string, cutoff: Date) {
	return {
		userId,
		status: "active" as const,
		isDailyStanding: false,
		OR: [
			{ updatedAt: { lte: cutoff } },
			{ updatedAt: null, createdAt: { lte: cutoff } },
		],
	};
}

type StaleArchiveDb = {
	task: {
		updateMany: (args: {
			where: ReturnType<typeof buildStaleArchiveUpdateWhere>;
			data: { status: "archived"; archivedAt: Date };
		}) => Promise<{ count: number }>;
	};
};

export async function archiveStaleTasksForUser(
	db: StaleArchiveDb,
	userId: string,
	now: Date = new Date(),
): Promise<number> {
	const cutoff = getStaleArchiveCutoff(now);
	const result = await db.task.updateMany({
		where: buildStaleArchiveUpdateWhere(userId, cutoff),
		data: {
			status: "archived",
			archivedAt: now,
		},
	});
	return result.count;
}
