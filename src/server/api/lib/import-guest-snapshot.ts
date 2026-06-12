import type { PrismaClient } from "@prisma/generated";

import type { GuestSnapshotV1 } from "~/lib/guest/schema";

export function resolveUniqueTitle(
	title: string,
	existingTitles: Set<string>,
): string {
	if (!existingTitles.has(title)) {
		return title;
	}

	let suffix = 2;
	while (existingTitles.has(`${title} (${suffix})`)) {
		suffix += 1;
	}

	return `${title} (${suffix})`;
}

export async function importGuestSnapshot(
	db: PrismaClient,
	userId: string,
	snapshot: GuestSnapshotV1,
): Promise<{ importedTasks: number; importedCycles: number }> {
	if (
		snapshot.tasks.length === 0 &&
		snapshot.sessions.length === 0 &&
		snapshot.cycles.length === 0
	) {
		return { importedTasks: 0, importedCycles: 0 };
	}

	return db.$transaction(async (tx) => {
		// Avoid duplicate RUNNING cycles when import is retried after a partial client failure.
		await tx.cycle.updateMany({
			where: { userId, state: "RUNNING" },
			data: { state: "COMPLETED", endedAt: new Date() },
		});

		const existingTasks = await tx.task.findMany({
			where: { userId },
			select: { title: true },
		});
		const existingTitles = new Set(existingTasks.map((task) => task.title));
		const taskIdMap = new Map<string, number>();

		const maxSortOrderResult = await tx.task.aggregate({
			where: { userId },
			_max: { sortOrder: true },
		});
		const baseOffset = (maxSortOrderResult._max.sortOrder ?? -1) + 1;
		const sortedGuestTasks = [...snapshot.tasks].sort(
			(a, b) => a.sortOrder - b.sortOrder,
		);

		for (const [relativeIndex, guestTask] of sortedGuestTasks.entries()) {
			const title = resolveUniqueTitle(guestTask.title, existingTitles);
			existingTitles.add(title);
			const urgency = guestTask.urgency ?? guestTask.weight;

			const created = await tx.task.create({
				data: {
					title,
					status: guestTask.status,
					userId,
					workType: guestTask.workType,
					weight: urgency,
					importance: guestTask.importance ?? 2,
					urgency,
					effortMinutes: guestTask.effortMinutes ?? null,
					commitmentHorizon: guestTask.commitmentHorizon ?? "WHEN_POSSIBLE",
					sortOrder: baseOffset + relativeIndex,
					resumeNote: guestTask.resumeNote ?? null,
				},
			});

			taskIdMap.set(guestTask.id, created.id);
		}

		let sessionId: number | null = null;
		const guestSession = snapshot.sessions[0];
		if (guestSession != null) {
			const createdSession = await tx.session.create({
				data: {
					userId,
					state: guestSession.state,
					startedAt: guestSession.startedAt,
					endedAt: guestSession.endedAt,
					lastActivityAt: guestSession.lastActivityAt,
					interruptionCount: guestSession.interruptionCount,
				},
			});
			sessionId = createdSession.id;
		}

		const now = Date.now();
		let importedCycles = 0;

		for (const guestCycle of snapshot.cycles) {
			if (sessionId == null) {
				const createdSession = await tx.session.create({
					data: { userId },
				});
				sessionId = createdSession.id;
			}

			const mappedTaskId =
				guestCycle.taskId != null
					? (taskIdMap.get(guestCycle.taskId) ?? null)
					: null;

			const expiresAt =
				guestCycle.startedAt.getTime() +
				guestCycle.configuredDurationSec * 1000;
			const isExpired = expiresAt <= now;
			const state =
				guestCycle.state === "RUNNING" && !isExpired
					? "RUNNING"
					: guestCycle.state === "RUNNING" && isExpired
						? "COMPLETED"
						: guestCycle.state;
			const endedAt =
				state === "COMPLETED" || state === "INTERRUPTED"
					? (guestCycle.endedAt ?? new Date(expiresAt))
					: null;

			await tx.cycle.create({
				data: {
					sessionId,
					userId,
					taskId: mappedTaskId,
					kind: guestCycle.kind,
					state,
					configuredDurationSec: guestCycle.configuredDurationSec,
					startedAt: guestCycle.startedAt,
					endedAt,
				},
			});

			importedCycles += 1;
		}

		return {
			importedTasks: snapshot.tasks.length,
			importedCycles,
		};
	});
}
