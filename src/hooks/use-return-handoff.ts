"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";

import { useGuestDomainTasks } from "~/lib/data-mode/use-domain-tasks";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import {
	composeReturnHandoffLine,
	findGuestLastEndedSession,
	markHandoffDismissed,
	readDismissedHandoffSessionIds,
	shouldShowReturnHandoffForSession,
} from "~/lib/session/return-handoff";
import { api } from "~/trpc/react";

function guestHasActiveSession(): boolean {
	return loadSnapshot().sessions.some((session) => session.state === "ACTIVE");
}

function getGuestActiveSessionSnapshot(): boolean {
	return guestHasActiveSession();
}

function getGuestActiveSessionServerSnapshot(): boolean {
	return false;
}

type UseReturnHandoffResult = {
	handoffLine: string | null;
	visible: boolean;
	dismiss: () => void;
};

function getGuestEndedSessionSnapshot() {
	return findGuestLastEndedSession(loadSnapshot().sessions);
}

function getGuestEndedSessionServerSnapshot() {
	return null;
}

export function useReturnHandoff(
	isAuthenticated: boolean,
	suppressed: boolean,
): UseReturnHandoffResult {
	const [dismissedSessionIds, setDismissedSessionIds] = useState<string[]>([]);

	useEffect(() => {
		setDismissedSessionIds(readDismissedHandoffSessionIds());
	}, []);

	const { data: lastEnded } = api.session.getLastEnded.useQuery(undefined, {
		enabled: isAuthenticated,
		staleTime: 60_000,
	});

	const { data: authTasks } = api.task.list.useQuery(undefined, {
		enabled: isAuthenticated,
		staleTime: 30_000,
	});

	const { data: activeCycle } = api.cycle.getActive.useQuery(undefined, {
		enabled: isAuthenticated,
		staleTime: 10_000,
	});

	const guestHasActive = useSyncExternalStore(
		subscribeGuestStore,
		getGuestActiveSessionSnapshot,
		getGuestActiveSessionServerSnapshot,
	);

	const inLiveSession = isAuthenticated ? activeCycle != null : guestHasActive;

	const { tasks: guestTasks } = useGuestDomainTasks();
	const guestLastEnded = useSyncExternalStore(
		subscribeGuestStore,
		getGuestEndedSessionSnapshot,
		getGuestEndedSessionServerSnapshot,
	);

	const endedSession = useMemo(() => {
		if (isAuthenticated) {
			if (lastEnded?.endedAt == null) {
				return null;
			}
			return {
				sessionId: lastEnded.id,
				endedAt: lastEnded.endedAt,
				closureLine: lastEnded.closureLine ?? null,
			};
		}

		if (guestLastEnded?.endedAt == null) {
			return null;
		}

		return {
			sessionId: guestLastEnded.id,
			endedAt: guestLastEnded.endedAt,
			closureLine: guestLastEnded.closureLine ?? null,
		};
	}, [guestLastEnded, isAuthenticated, lastEnded]);

	const tasks = isAuthenticated ? (authTasks ?? []) : guestTasks;

	const handoffLine = useMemo(() => {
		if (endedSession == null) {
			return null;
		}
		return composeReturnHandoffLine(endedSession, tasks);
	}, [endedSession, tasks]);

	const gateOpen =
		endedSession != null &&
		handoffLine != null &&
		shouldShowReturnHandoffForSession({
			sessionId: endedSession.sessionId,
			endedAt: endedSession.endedAt,
			dismissedSessionIds,
		});

	const visible = gateOpen && !suppressed && !inLiveSession;

	const dismiss = useCallback(() => {
		if (endedSession == null) {
			return;
		}
		markHandoffDismissed(endedSession.sessionId);
		setDismissedSessionIds(readDismissedHandoffSessionIds());
	}, [endedSession]);

	return {
		handoffLine,
		visible,
		dismiss,
	};
}
