import type { GuestSession } from "~/lib/guest/schema";

import {
	buildReturnHandoff,
	shouldShowReturnHandoff,
} from "./narrative-builder";

export {
	buildReturnHandoff,
	RETURN_HANDOFF_THRESHOLD_MS,
	shouldShowReturnHandoff,
} from "./narrative-builder";

export const HANDOFF_DISMISS_PREFIX = "flowstate:handoff-dismissed:";

export function handoffDismissStorageKey(sessionId: number | string): string {
	return `${HANDOFF_DISMISS_PREFIX}${String(sessionId)}`;
}

export function readDismissedHandoffSessionIds(): string[] {
	if (typeof window === "undefined") {
		return [];
	}

	try {
		const dismissed: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(HANDOFF_DISMISS_PREFIX)) {
				dismissed.push(key.slice(HANDOFF_DISMISS_PREFIX.length));
			}
		}
		return dismissed;
	} catch {
		return [];
	}
}

export function isHandoffDismissed(sessionId: number | string): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	try {
		return localStorage.getItem(handoffDismissStorageKey(sessionId)) != null;
	} catch {
		return false;
	}
}

export function markHandoffDismissed(sessionId: number | string): void {
	if (typeof window === "undefined") {
		return;
	}
	try {
		localStorage.setItem(handoffDismissStorageKey(sessionId), "1");
	} catch {
		// Private mode / quota — degrade gracefully
	}
}

export type HandoffTaskContext = {
	resumeNote: string | null;
	taskTitle: string | null;
};

export function pickHandoffTaskContext(
	tasks: Array<{
		status: string;
		title: string;
		resumeNote?: string | null;
	}>,
): HandoffTaskContext {
	const activeTasks = tasks.filter((task) => task.status === "active");
	const withNote = activeTasks.find(
		(task) => task.resumeNote != null && task.resumeNote.trim().length > 0,
	);
	if (withNote != null) {
		return {
			resumeNote: withNote.resumeNote?.trim() ?? null,
			taskTitle: withNote.title,
		};
	}

	const firstActive = activeTasks[0];
	return {
		resumeNote: null,
		taskTitle: firstActive?.title ?? null,
	};
}

export function findGuestLastEndedSession(
	sessions: GuestSession[],
): GuestSession | null {
	const ended = sessions.filter(
		(session) =>
			session.endedAt != null &&
			(session.state === "ENDED_BY_USER" ||
				session.state === "ENDED_BY_TIMEOUT"),
	);
	if (ended.length === 0) {
		return null;
	}

	const sorted = [...ended].sort((a, b) => {
		const aEnded = a.endedAt?.getTime() ?? 0;
		const bEnded = b.endedAt?.getTime() ?? 0;
		return bEnded - aEnded;
	});

	return sorted[0] ?? null;
}

export function composeReturnHandoffLine(
	endedSession: {
		closureLine: string | null;
	},
	tasks: Array<{
		status: string;
		title: string;
		resumeNote?: string | null;
	}>,
): string | null {
	const taskContext = pickHandoffTaskContext(tasks);
	return buildReturnHandoff({
		closureLine: endedSession.closureLine,
		resumeNote: taskContext.resumeNote,
		taskTitle: taskContext.taskTitle,
	});
}

export function shouldShowReturnHandoffForSession(input: {
	sessionId: number | string;
	endedAt: Date | null;
	dismissedSessionIds?: string[];
}): boolean {
	return shouldShowReturnHandoff({
		sessionId: input.sessionId,
		endedAt: input.endedAt,
		dismissedSessionIds:
			input.dismissedSessionIds ?? readDismissedHandoffSessionIds(),
	});
}
