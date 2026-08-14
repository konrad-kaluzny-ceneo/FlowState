import type { GuestSnapshotV1 } from "~/lib/guest/schema";
import {
	buildClosureLine,
	type ClosureLineInput,
} from "~/lib/session/narrative-builder";

export type GuestSessionEndMetadata = {
	closureLine: string;
	lastFocusedTaskId: string | null;
};

export function resolveGuestLastFocusedTaskId(
	snapshot: GuestSnapshotV1,
	sessionId: string,
): string | null {
	const activeWorkCycle = [...snapshot.cycles]
		.filter(
			(cycle) =>
				cycle.sessionId === sessionId &&
				cycle.kind === "WORK" &&
				(cycle.state === "RUNNING" || cycle.state === "PAUSED") &&
				cycle.taskId != null,
		)
		.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];

	if (activeWorkCycle?.taskId != null) {
		return activeWorkCycle.taskId;
	}

	const lastWorkCycle = [...snapshot.cycles]
		.filter(
			(cycle) =>
				cycle.sessionId === sessionId &&
				cycle.kind === "WORK" &&
				cycle.taskId != null,
		)
		.sort((a, b) => {
			const endedDiff =
				(b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0);
			if (endedDiff !== 0) {
				return endedDiff;
			}
			return b.startedAt.getTime() - a.startedAt.getTime();
		})[0];

	return lastWorkCycle?.taskId ?? null;
}

function resolveGuestClosureStats(
	snapshot: GuestSnapshotV1,
	sessionId: string,
): Omit<ClosureLineInput, "endedBy"> {
	const sessionCycles = snapshot.cycles.filter(
		(cycle) => cycle.sessionId === sessionId,
	);
	const cyclesCompleted = sessionCycles.filter(
		(cycle) => cycle.kind === "WORK" && cycle.state === "COMPLETED",
	).length;
	const tasksCompleted = sessionCycles.filter((cycle) => {
		if (cycle.kind !== "WORK" || cycle.state !== "COMPLETED") {
			return false;
		}
		if (cycle.taskId == null) {
			return false;
		}
		const task = snapshot.tasks.find((entry) => entry.id === cycle.taskId);
		return task?.status === "completed";
	}).length;

	return {
		cyclesCompleted,
		tasksCompleted,
		latestEnergy: null,
	};
}

export function computeGuestSessionEndMetadata(
	snapshot: GuestSnapshotV1,
	sessionId: string,
	endedBy: ClosureLineInput["endedBy"],
): GuestSessionEndMetadata {
	const closureStats = resolveGuestClosureStats(snapshot, sessionId);

	return {
		closureLine: buildClosureLine({ ...closureStats, endedBy }),
		lastFocusedTaskId: resolveGuestLastFocusedTaskId(snapshot, sessionId),
	};
}
