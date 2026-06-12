import type { EnergyLevel } from "@prisma/generated";

import { loadSnapshot } from "~/lib/guest/store";

export type SessionNarrativeStats = {
	tasksCompleted: number;
	latestEnergy: EnergyLevel | null;
	intention: string | null;
};

type AuthNarrativeClient = {
	client: {
		cycle: {
			countTasksCompletedInSession: {
				query: (input: { sessionId: number }) => Promise<number>;
			};
			getLatestCheckInEnergy: {
				query: (input: { sessionId: number }) => Promise<EnergyLevel | null>;
			};
			list: {
				query: (input: { sessionId: number }) => Promise<
					Array<{
						kind: string;
						intention?: string | null;
					}>
				>;
			};
		};
	};
};

export async function fetchAuthNarrativeStats(
	utils: AuthNarrativeClient,
	sessionId: number,
): Promise<SessionNarrativeStats> {
	const [tasksCompleted, latestEnergy, cycles] = await Promise.all([
		utils.client.cycle.countTasksCompletedInSession.query({ sessionId }),
		utils.client.cycle.getLatestCheckInEnergy.query({ sessionId }),
		utils.client.cycle.list.query({ sessionId }),
	]);

	const firstWorkWithIntention = cycles.find(
		(cycle) => cycle.kind === "WORK" && cycle.intention?.trim(),
	);

	return {
		tasksCompleted,
		latestEnergy,
		intention: firstWorkWithIntention?.intention?.trim() ?? null,
	};
}

export function getGuestNarrativeStats(
	sessionId: string,
): SessionNarrativeStats {
	const snapshot = loadSnapshot();

	const sessionCycles = snapshot.cycles.filter(
		(cycle) => cycle.sessionId === sessionId,
	);

	const tasksCompleted = sessionCycles.filter(
		(cycle) =>
			cycle.kind === "WORK" &&
			cycle.state === "COMPLETED" &&
			cycle.taskId != null &&
			snapshot.tasks.find((task) => task.id === cycle.taskId)?.status ===
				"completed",
	).length;

	const firstWorkWithIntention = sessionCycles.find(
		(cycle) => cycle.kind === "WORK" && cycle.intention?.trim(),
	);

	return {
		tasksCompleted,
		latestEnergy: null,
		intention: firstWorkWithIntention?.intention?.trim() ?? null,
	};
}

export function sessionHasWorkCycle(
	sessionId: number | string,
	mode: "authenticated" | "guest",
	cycles?: Array<{ kind: string; sessionId?: number | string }>,
): boolean {
	if (mode === "guest") {
		const snapshot = loadSnapshot();
		return snapshot.cycles.some(
			(cycle) => cycle.sessionId === sessionId && cycle.kind === "WORK",
		);
	}

	return (
		cycles?.some(
			(cycle) =>
				cycle.kind === "WORK" &&
				(cycle.sessionId == null || cycle.sessionId === sessionId),
		) ?? false
	);
}
