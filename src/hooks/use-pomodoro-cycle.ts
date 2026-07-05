"use client";

import { useLocale, useTranslations } from "next-intl";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createAudioManager } from "~/lib/audio";
import { maybeAlertBreakStart } from "~/lib/break-out-of-tab-alert/maybe-alert-break-start";
import { getNotificationPermission } from "~/lib/break-out-of-tab-alert/notify-break-start";
import { deriveCatchUpGate } from "~/lib/catch-up/derive-gate";
import type { CatchUpState } from "~/lib/catch-up/types";
import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";
import {
	startCycleEndTabPulse,
	stopCycleEndTabPulse,
} from "~/lib/cycle-end-tab-pulse";
import {
	useDataMode,
	useRepositories,
} from "~/lib/data-mode/data-mode-context";
import type {
	DataMode,
	DomainActiveCycle,
	DomainTaskId,
	FocusedTask,
} from "~/lib/data-mode/types";

type CreatedActiveCycle = Omit<DomainActiveCycle, "task"> & {
	task?: DomainActiveCycle["task"];
};

import type { EnergyLevel } from "~/lib/domain/energy-level";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getLongBreakDuration,
	getShortBreakDuration,
	setLastDuration,
} from "~/lib/duration-storage";
import { GUEST_STORAGE_KEY, type GuestSession } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { OnboardingScope } from "~/lib/onboarding/types";
import { PAUSE_CAP_MS } from "~/lib/pause-cap";
import type { RationaleBreakdown } from "~/lib/scoring/rationale-breakdown";
import {
	buildClosureLine,
	buildInFlowSummary,
} from "~/lib/session/narrative-builder";
import {
	fetchAuthNarrativeStats,
	getGuestNarrativeStats,
	sessionHasWorkCycle,
} from "~/lib/session/narrative-context";
import {
	findGuestLastEndedSession,
	resolveContinueTaskId,
} from "~/lib/session/return-handoff";
import {
	BREAK_TRANSITION_VISIBLE_MS,
	type BreakKind,
	getBreakStartLine,
} from "~/lib/session/transition-copy";
import {
	buildWindDownRationale,
	shouldShowWindDownNudge,
} from "~/lib/session/wind-down-nudge";
import {
	getOverrideAckLine,
	OVERRIDE_ACK_VISIBLE_MS,
} from "~/lib/suggestion/override-ack-copy";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { beginSuggestionFetch } from "~/lib/trpc/suggestion-priority";
import {
	computeKickoffEligible,
	effectiveWorkCyclesAtCheckIn,
} from "~/lib/wedge/transition-conductor";
import { setWorkTypeDuration } from "~/lib/work-type-duration-storage";
import { api } from "~/trpc/react";
import type {
	TimerWorkerInbound,
	TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

export const POMODORO_ALARM_URL = "/sounds/pomodoro-complete.mp3";

const closureShownStorageKey = (sessionId: number | string) =>
	`flowstate:closure-shown:${String(sessionId)}`;

function markClosureShown(sessionId: number | string) {
	if (typeof window === "undefined") {
		return;
	}
	sessionStorage.setItem(closureShownStorageKey(sessionId), "1");
}

function wasClosureShown(sessionId: number | string): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return sessionStorage.getItem(closureShownStorageKey(sessionId)) === "1";
}

let cachedGuestLastEndedKey: string | undefined;
let cachedGuestLastEnded: GuestSession | null = null;

function getGuestLastEndedSnapshot(): GuestSession | null {
	if (typeof window === "undefined") {
		return null;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY) ?? "";
	if (storageValue === cachedGuestLastEndedKey) {
		return cachedGuestLastEnded;
	}

	cachedGuestLastEndedKey = storageValue;
	cachedGuestLastEnded = findGuestLastEndedSession(loadSnapshot().sessions);
	return cachedGuestLastEnded;
}

type CompleteCycleArgs = {
	cycleId: DomainTaskId;
	markTaskDone?: boolean;
	incrementInterruption?: boolean;
};

function withWorkDayPlanKey(
	input: CompleteCycleArgs,
	options: {
		kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
		mode: DataMode;
	},
): CompleteCycleArgs & { localDateKey?: string } {
	if (options.mode !== "authenticated" || options.kind !== "WORK") {
		return input;
	}
	return { ...input, localDateKey: formatLocalDateKey() };
}

function taskPoolHasKickoffCandidates(
	tasks: Array<{
		status: string;
		isDailyStanding: boolean;
		doneForToday?: boolean;
	}>,
): boolean {
	return tasks.some(
		(task) =>
			task.status !== "archived" &&
			task.status !== "planned" &&
			!task.doneForToday &&
			(task.status === "active" || task.isDailyStanding),
	);
}

export { taskPoolHasKickoffCandidates };

/** E2E uses Playwright fake timers; server `startedAt` must not drive break expiry. */
const useE2eClientTimer = process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER === "1";

function cycleEndTimeMs(cycle: {
	startedAt: Date;
	configuredDurationSec: number;
	state?: DomainActiveCycle["state"];
	remainingDurationSec?: number | null;
}): number {
	if (cycle.state === "PAUSED" && cycle.remainingDurationSec != null) {
		return Date.now() + cycle.remainingDurationSec * 1000;
	}
	if (useE2eClientTimer) {
		return Date.now() + cycle.configuredDurationSec * 1000;
	}
	return cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
}

function pausedRemainingMs(cycle: DomainActiveCycle): number {
	return Math.max(0, (cycle.remainingDurationSec ?? 0) * 1000);
}

export type { FocusedTask };

export type PomodoroCycleState = "idle" | "running" | "paused" | "completed";

export type CycleKind = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

export type SuggestionResult = {
	cycleId: number;
	taskId: number;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	rationaleKey: string;
	rationale: string;
	breakdown: RationaleBreakdown;
	resumeNote: string | null;
};

export type PendingSuggestion =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: SuggestionResult }
	| { status: "empty" }
	| { status: "error" };

export type KickoffSuggestionResult = {
	sessionId: number;
	taskId: number;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	rationaleKey: string;
	rationale: string;
	breakdown: RationaleBreakdown;
	resumeNote: string | null;
};

export type PendingKickoffSuggestion =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; data: KickoffSuggestionResult }
	| { status: "empty" }
	| { status: "error" };

let activeCycleRecoveredForMode: string | null = null;
const recoveryResetListeners = new Set<() => void>();

let nextOptimisticCycleId = 0;

function allocateOptimisticCycleId(): number {
	nextOptimisticCycleId -= 1;
	return nextOptimisticCycleId;
}

function computeBreakAfterWork(completedWorkCycles: number): {
	newCount: number;
	breakKind: "SHORT_BREAK" | "LONG_BREAK";
	breakDurationSec: number;
} {
	const newCount = completedWorkCycles + 1;
	const breakKind: "SHORT_BREAK" | "LONG_BREAK" =
		newCount % 4 === 0 ? "LONG_BREAK" : "SHORT_BREAK";
	const breakDurationSec =
		breakKind === "LONG_BREAK"
			? getLongBreakDuration()
			: getShortBreakDuration();
	return { newCount, breakKind, breakDurationSec };
}

type WedgeTransitionSnapshot = {
	awaitingCheckIn: boolean;
	pendingMarkTaskDone: boolean | null;
	activeCycle: DomainActiveCycle | null;
	state: PomodoroCycleState;
	cycleKind: CycleKind | null;
	remainingMs: number;
	endTime: number | null;
	completedWorkCycles: number;
};

export type WedgeSyncPhase =
	| "check_in"
	| "complete_work"
	| "start_break"
	| "suggestion_fetch"
	| "kickoff_session"
	| "kickoff_suggestion";

export type PendingWedgeRecovery = {
	message: string;
	phase: WedgeSyncPhase;
	energy: EnergyLevel;
};

type PendingWedgeIntent = {
	phase: WedgeSyncPhase;
	energy: EnergyLevel;
	markTaskDone?: boolean;
	workCycleId?: number;
	sessionId?: number;
	sessionIntention?: string | null;
	breakKind?: "SHORT_BREAK" | "LONG_BREAK";
	breakDurationSec?: number;
};

function isBreakKind(kind: CycleKind | null): boolean {
	return kind === "SHORT_BREAK" || kind === "LONG_BREAK";
}

function maybeStartCycleEndTabPulse(
	cycleKind: CycleKind | null,
	wasHiddenWhileRunning: boolean,
	getMode: () => CycleEndAudioMode,
) {
	const mode = getMode();
	if (
		cycleKind !== "WORK" ||
		mode === "normal" ||
		(document.visibilityState === "visible" && !wasHiddenWhileRunning)
	) {
		return;
	}

	const prefersReducedMotion =
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	startCycleEndTabPulse({
		reducedMotion: prefersReducedMotion,
	});
}

/** Reset module-level recovery guard (tests + post-guest-import resume). */
export function resetActiveCycleRecoveryGuard(): void {
	activeCycleRecoveredForMode = null;
	for (const listener of recoveryResetListeners) {
		listener();
	}
}

function subscribeActiveCycleRecoveryReset(listener: () => void): () => void {
	recoveryResetListeners.add(listener);
	return () => {
		recoveryResetListeners.delete(listener);
	};
}

/** @deprecated Use resetActiveCycleRecoveryGuard */
export function resetActiveCycleRecoveryForTests(): void {
	resetActiveCycleRecoveryGuard();
}

async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (firstError) {
		try {
			return await fn();
		} catch {
			throw firstError;
		}
	}
}

export type UsePomodoroCycleOptions = {
	getCycleEndAudioMode?: () => CycleEndAudioMode;
	getOutOfTabBreakAlertsEnabled?: () => boolean;
	activeTaskIds?: ReadonlySet<DomainTaskId>;
	continueTasks?: Array<{ id: DomainTaskId; status: string }>;
};

export function usePomodoroCycle(options?: UsePomodoroCycleOptions) {
	const getCycleEndAudioModeRef = useRef<() => CycleEndAudioMode>(
		options?.getCycleEndAudioMode ?? (() => "normal"),
	);
	const getOutOfTabBreakAlertsEnabledRef = useRef<() => boolean>(
		options?.getOutOfTabBreakAlertsEnabled ?? (() => true),
	);
	const activeTaskIdsRef = useRef<ReadonlySet<DomainTaskId> | undefined>(
		options?.activeTaskIds,
	);

	useEffect(() => {
		getCycleEndAudioModeRef.current =
			options?.getCycleEndAudioMode ?? (() => "normal");
	}, [options?.getCycleEndAudioMode]);

	useEffect(() => {
		getOutOfTabBreakAlertsEnabledRef.current =
			options?.getOutOfTabBreakAlertsEnabled ?? (() => true);
	}, [options?.getOutOfTabBreakAlertsEnabled]);

	useEffect(() => {
		activeTaskIdsRef.current = options?.activeTaskIds;
	}, [options?.activeTaskIds]);

	const locale = useLocale() as UserLocale;
	const tErrors = useTranslations("Errors.cycle");
	const mode = useDataMode();
	const { cycles, sessions, tasks, refreshGuest } = useRepositories();
	const utils = api.useUtils();

	const [state, setState] = useState<PomodoroCycleState>("idle");
	const [remainingMs, setRemainingMs] = useState(0);
	const [focusedTaskId, setFocusedTaskId] = useState<DomainTaskId | null>(null);
	const [focusedTask, setFocusedTask] = useState<FocusedTask>(null);
	const [activeCycle, setActiveCycle] = useState<DomainActiveCycle | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [pendingWedgeRecovery, setPendingWedgeRecovery] =
		useState<PendingWedgeRecovery | null>(null);
	const [cycleKind, setCycleKind] = useState<CycleKind | null>(null);
	const [completedWorkCycles, setCompletedWorkCycles] = useState(0);
	const [_activeSessionId, setActiveSessionId] = useState<DomainTaskId | null>(
		null,
	);
	const [hasActiveSession, setHasActiveSession] = useState(false);
	const [midCyclePendingTask, setMidCyclePendingTask] =
		useState<FocusedTask>(null);
	const [isMidCycleSubmitting, setIsMidCycleSubmitting] = useState(false);
	const [awaitingCheckIn, setAwaitingCheckIn] = useState(false);
	const [pendingMarkTaskDone, setPendingMarkTaskDone] = useState<
		boolean | null
	>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion>(
		{
			status: "idle",
		},
	);
	const [suggestionCycleId, setSuggestionCycleId] = useState<number | null>(
		null,
	);
	const [suggestedTaskId, setSuggestedTaskId] = useState<DomainTaskId | null>(
		null,
	);
	const [preFocusedTask, setPreFocusedTask] = useState<FocusedTask>(null);
	const [hasPreFocusedSuggestion, setHasPreFocusedSuggestion] = useState(false);
	const [hasPreFocusedKickoff, setHasPreFocusedKickoff] = useState(false);
	const [stagedKickoffDurationSec, setStagedKickoffDurationSec] = useState<
		number | null
	>(null);
	const [isAcceptingKickoffSuggestion] = useState(false);
	const [overrideAcknowledgement, setOverrideAcknowledgement] = useState<
		string | null
	>(null);
	const [breakTransitionLine, setBreakTransitionLine] = useState<string | null>(
		null,
	);
	const [pendingKickoffSuggestion, setPendingKickoffSuggestion] =
		useState<PendingKickoffSuggestion>({ status: "idle" });
	const [kickoffSuggestedTaskId, setKickoffSuggestedTaskId] =
		useState<DomainTaskId | null>(null);
	const [sessionStartIdleFlag, setSessionStartIdleFlag] = useState(false);
	const [postBreakIdleFlag, setPostBreakIdleFlag] = useState(false);
	const [hasActiveTasks, setHasActiveTasks] = useState(false);
	const [awaitingWindDown, setAwaitingWindDown] = useState(false);
	const [isPostCheckInTransitioning, setIsPostCheckInTransitioning] =
		useState(false);
	const [windDownDismissed, setWindDownDismissed] = useState(false);
	const [windDownRationale, setWindDownRationale] = useState<string | null>(
		null,
	);
	const [catchUp, setCatchUp] = useState<CatchUpState>(null);
	const [sessionEnergyPending, setSessionEnergyPending] = useState(false);
	const [sessionSteeringSubmitting, setSessionSteeringSubmitting] =
		useState(false);
	const [sessionIntention, setSessionIntention] = useState<string | null>(null);
	const [narrativeTasksCompleted, setNarrativeTasksCompleted] = useState(0);
	const [narrativeLatestEnergy, setNarrativeLatestEnergy] =
		useState<EnergyLevel | null>(null);
	const [pendingClosureLine, setPendingClosureLine] = useState<string | null>(
		null,
	);
	const steeringAutoSkipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const lastSessionIntentionRef = useRef<string | null>(null);

	const createCheckIn = api.checkIn.create.useMutation();
	const suggestionNextPostCheckIn = api.suggestion.next.useMutation();
	const suggestionNextKickoff = api.suggestion.next.useMutation();
	const recordDecisionMutation = api.suggestion.recordDecision.useMutation();

	const { data: lastEndedSession } = api.session.getLastEnded.useQuery(
		undefined,
		{ enabled: mode === "authenticated", staleTime: 60_000 },
	);
	const { data: authTasksForContinue } = api.task.list.useQuery(undefined, {
		enabled: mode === "authenticated",
		staleTime: 30_000,
	});

	const guestLastEnded = useSyncExternalStore(
		subscribeGuestStore,
		getGuestLastEndedSnapshot,
		() => null,
	);

	const continueTaskId = useMemo(() => {
		if (hasActiveSession) {
			return null;
		}

		const lastEnded =
			mode === "authenticated" ? lastEndedSession : guestLastEnded;
		if (lastEnded?.endedAt == null) {
			return null;
		}

		const taskList =
			mode === "authenticated"
				? (authTasksForContinue ?? [])
				: (options?.continueTasks ?? []);

		return resolveContinueTaskId(lastEnded, taskList);
	}, [
		authTasksForContinue,
		guestLastEnded,
		hasActiveSession,
		lastEndedSession,
		mode,
		options?.continueTasks,
	]);

	const stateRef = useRef(state);
	const cycleKindRef = useRef(cycleKind);
	const awaitingCheckInRef = useRef(awaitingCheckIn);
	const isPostCheckInTransitioningRef = useRef(isPostCheckInTransitioning);
	const pendingSuggestionRef = useRef(pendingSuggestion);
	const endTimeRef = useRef<number | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const audioRef = useRef(createAudioManager());
	const recoveredRef = useRef(false);
	const pendingIncrementInterruptionRef = useRef(false);
	const pendingWindDownMarkTaskDoneRef = useRef<boolean | null>(null);
	const pendingWindDownWorkCycleIdRef = useRef<number | null>(null);
	const suggestionCycleIdRef = useRef<number | null>(null);
	const suggestionFetchGenRef = useRef(0);
	const kickoffFetchGenRef = useRef(0);
	const prevKickoffEligibleRef = useRef(false);
	const lastKickoffEnergyRef = useRef<"FOCUSED" | "STEADY" | "FADING">(
		"STEADY",
	);
	const overrideAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const breakTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const pauseCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const tabWasHiddenWhileRunningRef = useRef(false);
	const cancelPendingStartRef = useRef(false);
	const pendingCreateRef = useRef<Promise<CreatedActiveCycle> | null>(null);
	const pendingBreakCreateRef = useRef<Promise<CreatedActiveCycle> | null>(
		null,
	);
	// S-35 / test-plan risk #11: wedge network failures preserve intent in
	// pendingWedgeIntentRef and replay via retryWedgeSync — no forced energy re-entry.
	const pendingWedgeIntentRef = useRef<PendingWedgeIntent | null>(null);
	const isWedgeSyncRetryingRef = useRef(false);
	const [isWedgeSyncRetrying, setIsWedgeSyncRetrying] = useState(false);
	const activeCycleRef = useRef(activeCycle);
	const useWorkerRef = useRef(
		process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER !== "1",
	);

	useEffect(() => {
		activeCycleRef.current = activeCycle;
	}, [activeCycle]);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	useEffect(() => {
		cycleKindRef.current = cycleKind;
	}, [cycleKind]);

	useEffect(() => {
		awaitingCheckInRef.current = awaitingCheckIn;
	}, [awaitingCheckIn]);

	useEffect(() => {
		isPostCheckInTransitioningRef.current = isPostCheckInTransitioning;
	}, [isPostCheckInTransitioning]);

	useEffect(() => {
		pendingSuggestionRef.current = pendingSuggestion;
	}, [pendingSuggestion]);

	const invalidateServerCycle = useCallback(async () => {
		if (mode === "authenticated") {
			await utils.cycle.getActive.invalidate();
		} else {
			refreshGuest();
		}
	}, [mode, refreshGuest, utils.cycle.getActive]);

	const invalidateDayPlan = useCallback(async () => {
		if (mode !== "authenticated") {
			return;
		}
		await utils.dayPlan.getOrCreate.invalidate({
			localDateKey: formatLocalDateKey(),
		});
	}, [mode, utils.dayPlan.getOrCreate]);

	const invalidateDailyRecap = useCallback(async () => {
		if (mode !== "authenticated") {
			return;
		}
		await utils.recap.getDaily.invalidate({
			localDateKey: formatLocalDateKey(),
		});
	}, [mode, utils.recap.getDaily]);

	const resolvePersistableCycleId =
		useCallback(async (): Promise<DomainTaskId> => {
			const current = activeCycleRef.current;
			if (current == null) {
				throw new Error("No active cycle");
			}

			const { id } = current;
			if (typeof id === "string" && id.length > 0) {
				return id;
			}
			if (typeof id === "number" && id > 0) {
				return id;
			}

			const pending = pendingCreateRef.current;
			if (pending != null) {
				const cycle = await pending;
				const createdId = cycle.id;
				if (typeof createdId === "number" && createdId > 0) {
					return createdId;
				}
				if (typeof createdId === "string" && createdId.length > 0) {
					return createdId;
				}
				throw new Error("Invalid cycle id from pending create");
			}

			throw new Error("Optimistic cycle without pending create");
		}, []);

	const resolveServerCycleId = useCallback(async (): Promise<number> => {
		const cycleId = await resolvePersistableCycleId();
		if (typeof cycleId !== "number" || cycleId <= 0) {
			throw new Error("Expected persisted numeric cycle id");
		}
		return cycleId;
	}, [resolvePersistableCycleId]);

	const stopFallbackTimer = useCallback(() => {
		if (fallbackIntervalRef.current != null) {
			clearInterval(fallbackIntervalRef.current);
			fallbackIntervalRef.current = null;
		}
	}, []);

	const stopWorker = useCallback(() => {
		workerRef.current?.postMessage({
			type: "stop",
		} satisfies TimerWorkerInbound);
		stopFallbackTimer();
	}, [stopFallbackTimer]);

	const setCatchUpFromExpiry = useCallback(
		(endedAtMs: number, cycleKindSnapshot: CycleKind | null) => {
			const gate = deriveCatchUpGate({
				state: "completed",
				cycleKind: cycleKindSnapshot,
				awaitingCheckIn:
					awaitingCheckInRef.current || isPostCheckInTransitioningRef.current,
				pendingSuggestionStatus: pendingSuggestionRef.current.status,
			});
			if (gate == null) {
				return;
			}
			setCatchUp({
				endedWhileHidden: true,
				cycleEndedAtMs: endedAtMs,
				gate,
			});
			tabWasHiddenWhileRunningRef.current = false;
		},
		[],
	);

	const handleCycleExpired = useCallback(() => {
		if (stateRef.current !== "running") {
			return;
		}
		const endedAtMs = endTimeRef.current ?? Date.now();
		const wasHiddenWhileRunning = tabWasHiddenWhileRunningRef.current;
		stopWorker();
		endTimeRef.current = null;
		setRemainingMs(0);
		setState("completed");
		void audioRef.current
			.playAlarm({ mode: getCycleEndAudioModeRef.current() })
			.catch(() => {});

		if (document.visibilityState !== "visible" || wasHiddenWhileRunning) {
			setCatchUpFromExpiry(endedAtMs, cycleKindRef.current);
		}

		stopCycleEndTabPulse();
		maybeStartCycleEndTabPulse(
			cycleKindRef.current,
			wasHiddenWhileRunning,
			() => getCycleEndAudioModeRef.current(),
		);
	}, [setCatchUpFromExpiry, stopWorker]);

	const fireBreakOutOfTabAlert = useCallback(
		(breakKind: CycleKind, cycleId: string | number) => {
			if (breakKind !== "SHORT_BREAK" && breakKind !== "LONG_BREAK") {
				return;
			}

			if (!getOutOfTabBreakAlertsEnabledRef.current()) {
				return;
			}

			const alertResult = maybeAlertBreakStart({
				breakKind,
				isTabHidden:
					typeof document !== "undefined" &&
					document.visibilityState !== "visible",
				outOfTabEnabled: getOutOfTabBreakAlertsEnabledRef.current(),
				notificationPermission: getNotificationPermission(),
				cycleEndAudioMode: getCycleEndAudioModeRef.current(),
				cycleId: String(cycleId),
			});

			if (alertResult.shouldPlayBackgroundAudio) {
				void audioRef.current
					.playAlarm({ mode: getCycleEndAudioModeRef.current() })
					.catch(() => {
						// Background break audio is best-effort when tab is hidden.
					});
			}
		},
		[],
	);

	const attachWorkerHandlers = useCallback(
		(worker: Worker) => {
			worker.onmessage = (event: MessageEvent<TimerWorkerOutbound>) => {
				const message = event.data;
				if (message.type === "tick") {
					setRemainingMs(message.remaining);
					return;
				}
				if (message.type === "complete") {
					handleCycleExpired();
				}
			};
		},
		[handleCycleExpired],
	);

	const startFallbackTimer = useCallback(
		(endTime: number) => {
			stopFallbackTimer();
			endTimeRef.current = endTime;

			const tick = () => {
				if (endTimeRef.current !== endTime) {
					return;
				}
				const remaining = endTime - Date.now();
				if (remaining <= 0) {
					stopFallbackTimer();
					handleCycleExpired();
					return;
				}
				setRemainingMs(remaining);
			};

			tick();
			fallbackIntervalRef.current = setInterval(tick, 1000);
		},
		[handleCycleExpired, stopFallbackTimer],
	);

	const startWorker = useCallback(
		(endTime: number) => {
			endTimeRef.current = endTime;
			setRemainingMs(Math.max(0, endTime - Date.now()));

			if (useWorkerRef.current && typeof Worker !== "undefined") {
				try {
					if (workerRef.current == null) {
						workerRef.current = new Worker(
							new URL("../workers/timer-worker.ts", import.meta.url),
							{ type: "module" },
						);
						attachWorkerHandlers(workerRef.current);
					}

					stopFallbackTimer();
					workerRef.current.postMessage({
						type: "start",
						endTime,
					} satisfies TimerWorkerInbound);
					return;
				} catch {
					useWorkerRef.current = false;
					workerRef.current?.terminate();
					workerRef.current = null;
				}
			}

			startFallbackTimer(endTime);
		},
		[attachWorkerHandlers, startFallbackTimer, stopFallbackTimer],
	);

	const recalculateFromEndTime = useCallback(() => {
		if (stateRef.current !== "running") {
			return;
		}

		const endTime = endTimeRef.current;
		if (endTime == null) {
			return;
		}

		const remaining = endTime - Date.now();
		if (remaining <= 0) {
			handleCycleExpired();
			return;
		}

		setRemainingMs(remaining);
	}, [handleCycleExpired]);

	const resumeFromActiveCycle = useCallback(
		(cycle: DomainActiveCycle) => {
			setActiveCycle(cycle);
			setCycleKind(cycle.kind);
			setActiveSessionId(cycle.sessionId);
			setHasActiveSession(true);
			setFocusedTask(
				cycle.task != null
					? { id: cycle.task.id, title: cycle.task.title }
					: null,
			);
			setFocusedTaskId(cycle.taskId);

			void audioRef.current.preload(POMODORO_ALARM_URL).catch(() => {});

			if (cycle.state === "PAUSED") {
				stopWorker();
				const frozenRemainingMs = pausedRemainingMs(cycle);
				setState("paused");
				stateRef.current = "paused";
				setRemainingMs(frozenRemainingMs);
				endTimeRef.current = null;
				return;
			}

			const endTime = cycleEndTimeMs(cycle);

			if (endTime <= Date.now()) {
				setState("completed");
				void audioRef.current
					.playAlarm({ mode: getCycleEndAudioModeRef.current() })
					.catch(() => {});
				setCatchUpFromExpiry(endTime, cycle.kind);
				stopCycleEndTabPulse();
				maybeStartCycleEndTabPulse(
					cycle.kind,
					tabWasHiddenWhileRunningRef.current,
					() => getCycleEndAudioModeRef.current(),
				);
				return;
			}

			setState("running");
			stateRef.current = "running";
			startWorker(endTime);
		},
		[setCatchUpFromExpiry, startWorker, stopWorker],
	);

	const buildSessionClosureLine = useCallback(
		(
			endedBy: "user" | "timeout" | "pause_cap",
			options?: { interruptedMidCycle?: boolean },
		) =>
			buildClosureLine({
				cyclesCompleted: completedWorkCycles,
				tasksCompleted: narrativeTasksCompleted,
				latestEnergy: narrativeLatestEnergy,
				endedBy,
				interruptedMidCycle: options?.interruptedMidCycle,
			}),
		[completedWorkCycles, narrativeTasksCompleted, narrativeLatestEnergy],
	);

	const presentClosureOverlay = useCallback(
		(line: string, sessionId: number | string) => {
			if (wasClosureShown(sessionId)) {
				return;
			}
			markClosureShown(sessionId);
			setPendingClosureLine(line);
		},
		[],
	);

	const maybePresentTimeoutClosure = useCallback(
		async (priorSessionId: DomainTaskId) => {
			if (wasClosureShown(priorSessionId)) {
				return;
			}

			const priorKey = String(priorSessionId);
			let line: string | null = null;

			if (mode === "authenticated") {
				try {
					const lastEnded = await utils.client.session.getLastEnded.query();
					if (lastEnded != null && String(lastEnded.id) === priorKey) {
						line = lastEnded.closureLine ?? null;
					}
				} catch {
					// Best effort — timeout handoff degrades gracefully
				}
			} else {
				const prior = loadSnapshot().sessions.find(
					(session) => session.id === priorKey,
				);
				if (
					prior != null &&
					(prior.state === "ENDED_BY_TIMEOUT" ||
						prior.state === "ENDED_BY_USER")
				) {
					line = prior.closureLine ?? null;
				}
			}

			if (line != null) {
				presentClosureOverlay(line, priorSessionId);
			}
		},
		[mode, utils, presentClosureOverlay],
	);

	const clearPauseCapTimer = useCallback(() => {
		if (pauseCapTimerRef.current != null) {
			clearTimeout(pauseCapTimerRef.current);
			pauseCapTimerRef.current = null;
		}
	}, []);

	const endSessionRef = useRef<
		(options?: { endedBy?: "user" | "pause_cap" }) => Promise<void>
	>(async () => {});

	const schedulePauseCapTimer = useCallback(
		(pausedAt: Date | null | undefined) => {
			clearPauseCapTimer();
			if (pausedAt == null) {
				return;
			}

			const delay = pausedAt.getTime() + PAUSE_CAP_MS - Date.now();
			pauseCapTimerRef.current = setTimeout(
				() => {
					pauseCapTimerRef.current = null;
					void endSessionRef.current({ endedBy: "pause_cap" });
				},
				Math.max(0, delay),
			);
		},
		[clearPauseCapTimer],
	);

	const pausedAtMs = activeCycle?.pausedAt?.getTime() ?? null;

	useEffect(() => {
		if (state !== "paused" || pausedAtMs == null) {
			clearPauseCapTimer();
			return;
		}

		schedulePauseCapTimer(new Date(pausedAtMs));
		return clearPauseCapTimer;
	}, [state, pausedAtMs, schedulePauseCapTimer, clearPauseCapTimer]);

	const recoverActiveCycle = useCallback(async () => {
		if (activeCycleRecoveredForMode === mode || recoveredRef.current) {
			return;
		}

		recoveredRef.current = true;
		activeCycleRecoveredForMode = mode;

		const active = await cycles.getActive();

		if (active != null) {
			resumeFromActiveCycle(active);

			// Derive completed work cycle count from server for correct break cadence
			try {
				if (mode === "authenticated") {
					const count = await utils.client.cycle.countCompletedWork.query({
						sessionId: Number(active.sessionId),
					});
					setCompletedWorkCycles(count);
				} else {
					const { loadSnapshot } = await import("~/lib/guest/store");
					const snapshot = loadSnapshot();
					const count = snapshot.cycles.filter(
						(c) =>
							c.sessionId === active.sessionId &&
							c.kind === "WORK" &&
							c.state === "COMPLETED",
					).length;
					setCompletedWorkCycles(count);
				}
			} catch {
				// Best effort — counter stays at 0, worst case is wrong break type
			}
		} else {
			// No active cycle — session may have timed out server-side; reset counter
			setCompletedWorkCycles(0);

			try {
				if (mode === "authenticated") {
					const lastEnded = await utils.client.session.getLastEnded.query();
					if (lastEnded != null && lastEnded.state === "ENDED_BY_TIMEOUT") {
						await maybePresentTimeoutClosure(lastEnded.id);
					}
				} else {
					const prior = [...loadSnapshot().sessions]
						.reverse()
						.find((session) => session.state === "ENDED_BY_TIMEOUT");
					if (prior != null) {
						await maybePresentTimeoutClosure(prior.id);
					}
				}
			} catch {
				// Best effort — kickoff still available after hydrate
			}

			setSessionStartIdleFlag(true);
		}
	}, [cycles, resumeFromActiveCycle, mode, utils, maybePresentTimeoutClosure]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset recovery guard when auth mode changes
	useEffect(() => {
		recoveredRef.current = false;
	}, [mode]);

	useEffect(() => {
		void recoverActiveCycle();
	}, [recoverActiveCycle]);

	const loadActiveTasks = useCallback(() => {
		if (mode !== "authenticated") {
			setHasActiveTasks(false);
			return;
		}

		const queryTasks = utils.client.task?.list?.query;
		if (queryTasks == null) {
			setHasActiveTasks(false);
			return;
		}

		void queryTasks({ localDateKey: formatLocalDateKey() })
			.then((tasks) => {
				setHasActiveTasks(taskPoolHasKickoffCandidates(tasks));
			})
			.catch(() => {
				setHasActiveTasks(false);
			});
	}, [mode, utils]);

	useEffect(() => {
		loadActiveTasks();
	}, [loadActiveTasks]);

	const refreshNarrativeStats = useCallback(
		async (sessionId: DomainTaskId) => {
			try {
				if (mode === "authenticated") {
					const stats = await fetchAuthNarrativeStats(utils, Number(sessionId));
					setNarrativeTasksCompleted(stats.tasksCompleted);
					setNarrativeLatestEnergy(stats.latestEnergy);
					if (stats.intention) {
						setSessionIntention(stats.intention);
					}
					const sessionCycles = await utils.client.cycle.list.query({
						sessionId: Number(sessionId),
					});
					if (sessionHasWorkCycle(sessionId, "authenticated", sessionCycles)) {
						setSessionEnergyPending(false);
					}
				} else {
					const stats = getGuestNarrativeStats(String(sessionId));
					setNarrativeTasksCompleted(stats.tasksCompleted);
					setNarrativeLatestEnergy(stats.latestEnergy);
					if (stats.intention) {
						setSessionIntention(stats.intention);
					}
					if (sessionHasWorkCycle(sessionId, "guest")) {
						setSessionEnergyPending(false);
					}
				}
			} catch {
				// Best effort — summary line degrades gracefully
			}
		},
		[mode, utils],
	);

	useEffect(() => {
		if (!hasActiveSession || _activeSessionId == null) {
			return;
		}
		void refreshNarrativeStats(_activeSessionId);
	}, [hasActiveSession, _activeSessionId, refreshNarrativeStats]);

	useEffect(() => {
		if (completedWorkCycles > 0) {
			setSessionEnergyPending(false);
		}
	}, [completedWorkCycles]);

	useEffect(() => {
		return subscribeActiveCycleRecoveryReset(() => {
			recoveredRef.current = false;
			void recoverActiveCycle();
		});
	}, [recoverActiveCycle]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				if (stateRef.current === "running") {
					tabWasHiddenWhileRunningRef.current = true;
				}
				return;
			}
			stopCycleEndTabPulse();
			if (
				stateRef.current === "running" &&
				endTimeRef.current != null &&
				endTimeRef.current > Date.now()
			) {
				tabWasHiddenWhileRunningRef.current = false;
			}
			recalculateFromEndTime();
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [recalculateFromEndTime]);

	useEffect(() => {
		return () => {
			stopWorker();
			workerRef.current?.terminate();
			workerRef.current = null;
			audioRef.current.dispose();
			stopCycleEndTabPulse();
			if (overrideAckTimerRef.current != null) {
				clearTimeout(overrideAckTimerRef.current);
			}
			if (breakTransitionTimerRef.current != null) {
				clearTimeout(breakTransitionTimerRef.current);
			}
		};
	}, [stopWorker]);

	const clearOverrideAck = useCallback(() => {
		if (overrideAckTimerRef.current != null) {
			clearTimeout(overrideAckTimerRef.current);
			overrideAckTimerRef.current = null;
		}
		setOverrideAcknowledgement(null);
	}, []);

	const showOverrideAck = useCallback(() => {
		clearOverrideAck();
		setOverrideAcknowledgement(getOverrideAckLine(locale));
		overrideAckTimerRef.current = setTimeout(() => {
			setOverrideAcknowledgement(null);
			overrideAckTimerRef.current = null;
		}, OVERRIDE_ACK_VISIBLE_MS);
	}, [clearOverrideAck, locale]);

	const clearBreakTransitionLine = useCallback(() => {
		if (breakTransitionTimerRef.current != null) {
			clearTimeout(breakTransitionTimerRef.current);
			breakTransitionTimerRef.current = null;
		}
		setBreakTransitionLine(null);
	}, []);

	const showBreakTransitionLine = useCallback(
		(breakKind: BreakKind) => {
			clearBreakTransitionLine();
			setBreakTransitionLine(getBreakStartLine(breakKind, locale));
			breakTransitionTimerRef.current = setTimeout(() => {
				setBreakTransitionLine(null);
				breakTransitionTimerRef.current = null;
			}, BREAK_TRANSITION_VISIBLE_MS);
		},
		[clearBreakTransitionLine, locale],
	);

	const clearKickoffSuggestion = useCallback(() => {
		kickoffFetchGenRef.current += 1;
		setPendingKickoffSuggestion({ status: "idle" });
		setKickoffSuggestedTaskId(null);
		setHasPreFocusedKickoff(false);
		setStagedKickoffDurationSec(null);
		setSessionEnergyPending(false);
		setSessionSteeringSubmitting(false);
	}, []);

	const clearStagedKickoffDuration = useCallback(() => {
		setStagedKickoffDurationSec(null);
	}, []);

	const clearKickoffIdleFlags = useCallback(() => {
		setSessionStartIdleFlag(false);
		setPostBreakIdleFlag(false);
	}, []);

	const clearSuggestion = useCallback(() => {
		suggestionFetchGenRef.current += 1;
		suggestionCycleIdRef.current = null;
		setPendingSuggestion({ status: "idle" });
		setSuggestionCycleId(null);
		setSuggestedTaskId(null);
		setHasPreFocusedSuggestion(false);
		clearOverrideAck();
	}, [clearOverrideAck]);

	const preFocusTask = useCallback(
		(taskId: DomainTaskId, task?: FocusedTask) => {
			setPreFocusedTask(task ?? { id: taskId, title: "" });
			setFocusedTaskId(taskId);
			setFocusedTask(task ?? null);
		},
		[],
	);

	const recordSuggestionDecision = useCallback(
		async (suggestedId: DomainTaskId, chosenId: DomainTaskId) => {
			if (suggestionCycleId == null) {
				return;
			}
			try {
				await retryOnce(() =>
					recordDecisionMutation.mutateAsync({
						context: "post_check_in",
						cycleId: suggestionCycleId,
						suggestedTaskId: Number(suggestedId),
						chosenTaskId: Number(chosenId),
					}),
				);
			} catch {
				setError(tErrors("suggestionDecisionSaveFailed"));
			}
		},
		[suggestionCycleId, recordDecisionMutation, tErrors],
	);

	const recordKickoffDecision = useCallback(
		async (suggestedId: DomainTaskId, chosenId: DomainTaskId) => {
			if (_activeSessionId == null) {
				return;
			}
			try {
				await retryOnce(() =>
					recordDecisionMutation.mutateAsync({
						context: "kickoff",
						sessionId: Number(_activeSessionId),
						suggestedTaskId: Number(suggestedId),
						chosenTaskId: Number(chosenId),
					}),
				);
			} catch {
				setError(tErrors("suggestionDecisionSaveFailed"));
			}
		},
		[_activeSessionId, recordDecisionMutation, tErrors],
	);

	const fetchPostCheckInSuggestion = useCallback(
		async (cycleId: number, gen: number) => {
			const result = await suggestionNextPostCheckIn.mutateAsync({
				context: "post_check_in",
				cycleId,
				localHour: new Date().getHours(),
				localDateKey: formatLocalDateKey(),
			});
			if (suggestionFetchGenRef.current !== gen) {
				return;
			}
			if (suggestionCycleIdRef.current !== cycleId) {
				return;
			}
			if (result == null) {
				setPendingSuggestion({ status: "empty" });
				setSuggestedTaskId(null);
			} else {
				const activeIds = activeTaskIdsRef.current;
				if (activeIds != null && !activeIds.has(result.taskId)) {
					setPendingSuggestion({ status: "empty" });
					setSuggestedTaskId(null);
					return;
				}
				setPendingSuggestion({
					status: "ready",
					data: {
						cycleId:
							"cycleId" in result && typeof result.cycleId === "number"
								? result.cycleId
								: cycleId,
						taskId: result.taskId,
						title: result.title,
						workType: result.workType,
						weight: result.weight,
						urgency: (result.urgency ?? result.weight) as 1 | 2 | 3,
						importance: (result.importance ?? 2) as 1 | 2 | 3,
						commitmentHorizon: result.commitmentHorizon ?? "WHEN_POSSIBLE",
						rationaleKey: result.rationaleKey,
						rationale: result.rationale,
						breakdown: result.breakdown,
						resumeNote: result.resumeNote ?? null,
					},
				});
				setSuggestedTaskId(result.taskId);
			}
		},
		[suggestionNextPostCheckIn],
	);

	const fetchSuggestion = useCallback(
		(cycleId: number) => {
			clearKickoffSuggestion();
			clearKickoffIdleFlags();
			const gen = ++suggestionFetchGenRef.current;
			suggestionCycleIdRef.current = cycleId;
			setPendingSuggestion({ status: "loading" });
			setSuggestionCycleId(cycleId);
			setSuggestedTaskId(null);
			setHasPreFocusedSuggestion(false);

			void (async () => {
				const endSuggestionFetch = beginSuggestionFetch();
				try {
					await fetchPostCheckInSuggestion(cycleId, gen);
				} catch {
					if (suggestionFetchGenRef.current !== gen) {
						return;
					}
					if (suggestionCycleIdRef.current !== cycleId) {
						return;
					}
					setPendingSuggestion({ status: "error" });
					setSuggestedTaskId(null);
				} finally {
					endSuggestionFetch();
				}
			})();
		},
		[clearKickoffSuggestion, clearKickoffIdleFlags, fetchPostCheckInSuggestion],
	);

	const fetchKickoffSuggestion = useCallback(
		(
			sessionId: number,
			energy: "FOCUSED" | "STEADY" | "FADING",
			intention?: string | null,
		) => {
			const gen = ++kickoffFetchGenRef.current;
			lastKickoffEnergyRef.current = energy;
			const trimmedIntention = intention?.trim() ?? null;
			lastSessionIntentionRef.current = trimmedIntention;
			setPendingKickoffSuggestion({ status: "loading" });
			setKickoffSuggestedTaskId(null);

			void (async () => {
				const endSuggestionFetch = beginSuggestionFetch();
				try {
					const result = await suggestionNextKickoff.mutateAsync({
						context: "kickoff",
						sessionId,
						localHour: new Date().getHours(),
						localDateKey: formatLocalDateKey(),
						energy,
						...(trimmedIntention != null && trimmedIntention.length > 0
							? { sessionIntention: trimmedIntention }
							: {}),
					});
					if (gen !== kickoffFetchGenRef.current) {
						return;
					}
					if (result == null) {
						setPendingKickoffSuggestion({ status: "empty" });
						setKickoffSuggestedTaskId(null);
					} else if (!("cycleId" in result)) {
						const activeIds = activeTaskIdsRef.current;
						if (activeIds != null && !activeIds.has(result.taskId)) {
							setPendingKickoffSuggestion({ status: "empty" });
							setKickoffSuggestedTaskId(null);
							return;
						}
						setPendingKickoffSuggestion({
							status: "ready",
							data: {
								...result,
								urgency: (result.urgency ?? result.weight) as 1 | 2 | 3,
								importance: (result.importance ?? 2) as 1 | 2 | 3,
								commitmentHorizon: result.commitmentHorizon ?? "WHEN_POSSIBLE",
							},
						});
						setKickoffSuggestedTaskId(result.taskId);
					}
					pendingWedgeIntentRef.current = null;
					setPendingWedgeRecovery(null);
				} catch {
					if (gen !== kickoffFetchGenRef.current) {
						return;
					}
					const recoveryMessage = tErrors("kickoffSuggestionLoadFailed");
					pendingWedgeIntentRef.current = {
						phase: "kickoff_suggestion",
						energy,
						sessionId,
						sessionIntention: trimmedIntention,
					};
					setPendingWedgeRecovery({
						message: recoveryMessage,
						phase: "kickoff_suggestion",
						energy,
					});
					setPendingKickoffSuggestion({ status: "error" });
					setKickoffSuggestedTaskId(null);
				} finally {
					endSuggestionFetch();
					setSessionSteeringSubmitting(false);
				}
			})();
		},
		[suggestionNextKickoff, tErrors],
	);

	const kickoffReadyTaskId =
		pendingKickoffSuggestion.status === "ready"
			? pendingKickoffSuggestion.data.taskId
			: null;
	const postCheckInReadyTaskId =
		pendingSuggestion.status === "ready" ? pendingSuggestion.data.taskId : null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: membership from ref; ready task ids listed explicitly
	useEffect(() => {
		const activeIds = activeTaskIdsRef.current;
		if (activeIds == null) {
			return;
		}

		const clearPreFocusForMissingTask = (taskId: DomainTaskId) => {
			if (preFocusedTask?.id !== taskId) {
				return;
			}
			setPreFocusedTask(null);
			setFocusedTaskId(null);
			setFocusedTask(null);
			setStagedKickoffDurationSec(null);
		};

		if (
			pendingKickoffSuggestion.status === "ready" &&
			!activeIds.has(pendingKickoffSuggestion.data.taskId)
		) {
			const { taskId } = pendingKickoffSuggestion.data;
			clearPreFocusForMissingTask(taskId);
			setHasPreFocusedKickoff(false);

			if (activeIds.size === 0 || _activeSessionId == null) {
				kickoffFetchGenRef.current += 1;
				setPendingKickoffSuggestion({ status: "empty" });
				setKickoffSuggestedTaskId(null);
			} else {
				fetchKickoffSuggestion(
					Number(_activeSessionId),
					lastKickoffEnergyRef.current,
					lastSessionIntentionRef.current,
				);
			}
		}

		if (
			pendingSuggestion.status === "ready" &&
			!activeIds.has(pendingSuggestion.data.taskId)
		) {
			const { taskId } = pendingSuggestion.data;
			clearPreFocusForMissingTask(taskId);
			setHasPreFocusedSuggestion(false);
			setSuggestedTaskId(null);

			if (activeIds.size === 0) {
				suggestionFetchGenRef.current += 1;
				setPendingSuggestion({ status: "empty" });
				return;
			}

			const cycleId = suggestionCycleIdRef.current;
			if (cycleId == null) {
				suggestionFetchGenRef.current += 1;
				setPendingSuggestion({ status: "empty" });
				return;
			}

			const gen = ++suggestionFetchGenRef.current;
			setPendingSuggestion({ status: "loading" });

			void (async () => {
				const endSuggestionFetch = beginSuggestionFetch();
				try {
					await fetchPostCheckInSuggestion(cycleId, gen);
				} catch {
					if (suggestionFetchGenRef.current !== gen) {
						return;
					}
					if (suggestionCycleIdRef.current !== cycleId) {
						return;
					}
					setPendingSuggestion({ status: "error" });
					setSuggestedTaskId(null);
				} finally {
					endSuggestionFetch();
				}
			})();
		}
	}, [
		options?.activeTaskIds,
		pendingKickoffSuggestion.status,
		pendingSuggestion.status,
		kickoffReadyTaskId,
		postCheckInReadyTaskId,
		preFocusedTask,
		_activeSessionId,
		fetchKickoffSuggestion,
		fetchPostCheckInSuggestion,
	]);

	const clearSteeringAutoSkipTimer = useCallback(() => {
		if (steeringAutoSkipTimerRef.current != null) {
			clearTimeout(steeringAutoSkipTimerRef.current);
			steeringAutoSkipTimerRef.current = null;
		}
	}, []);

	const completeSessionEnergy = useCallback(
		(energy: "FOCUSED" | "STEADY" | "FADING") => {
			if (_activeSessionId == null) {
				return;
			}
			clearSteeringAutoSkipTimer();
			setSessionEnergyPending(false);
			setSessionSteeringSubmitting(true);
			fetchKickoffSuggestion(
				Number(_activeSessionId),
				energy,
				lastSessionIntentionRef.current,
			);
		},
		[_activeSessionId, clearSteeringAutoSkipTimer, fetchKickoffSuggestion],
	);

	const skipSessionEnergy = useCallback(() => {
		if (_activeSessionId == null) {
			clearSteeringAutoSkipTimer();
			setSessionEnergyPending(false);
			return;
		}
		clearSteeringAutoSkipTimer();
		setSessionEnergyPending(false);
		const alreadyPrefetchedWithSkip =
			pendingKickoffSuggestion.status !== "idle" &&
			lastKickoffEnergyRef.current === "STEADY" &&
			lastSessionIntentionRef.current == null;
		if (alreadyPrefetchedWithSkip) {
			return;
		}
		setSessionSteeringSubmitting(true);
		fetchKickoffSuggestion(
			Number(_activeSessionId),
			"STEADY",
			lastSessionIntentionRef.current,
		);
	}, [
		_activeSessionId,
		clearSteeringAutoSkipTimer,
		fetchKickoffSuggestion,
		pendingKickoffSuggestion.status,
	]);

	const prefetchKickoffSteeringDefault = useCallback(() => {
		if (
			_activeSessionId == null ||
			pendingKickoffSuggestion.status !== "idle"
		) {
			return;
		}
		fetchKickoffSuggestion(Number(_activeSessionId), "STEADY", null);
	}, [
		_activeSessionId,
		fetchKickoffSuggestion,
		pendingKickoffSuggestion.status,
	]);

	const kickoffEligible = computeKickoffEligible({
		mode,
		state,
		cycleKind,
		focusedTaskId,
		awaitingCheckIn,
		awaitingWindDown,
		isPostCheckInTransitioning,
		pendingSuggestionStatus: pendingSuggestion.status,
		pendingClosureLine,
		hasActiveTasks,
		sessionStartIdleFlag,
		postBreakIdleFlag,
		cyclePaused: state === "paused",
	});

	useEffect(() => {
		const wasEligible = prevKickoffEligibleRef.current;
		prevKickoffEligibleRef.current = kickoffEligible;

		if (!kickoffEligible) {
			if (wasEligible && sessionEnergyPending) {
				setSessionEnergyPending(false);
			}
			return;
		}

		if (wasEligible || sessionEnergyPending) {
			return;
		}

		if (pendingKickoffSuggestion.status !== "idle") {
			return;
		}

		void (async () => {
			const gen = kickoffFetchGenRef.current;
			try {
				const session = await sessions.getOrCreateActive();
				if (gen !== kickoffFetchGenRef.current) {
					return;
				}
				setActiveSessionId(session.id);
				setSessionEnergyPending(true);
			} catch {
				if (gen !== kickoffFetchGenRef.current) {
					return;
				}
				const recoveryMessage = tErrors("sessionStartFailed");
				pendingWedgeIntentRef.current = {
					phase: "kickoff_session",
					energy: "STEADY",
				};
				setPendingWedgeRecovery({
					message: recoveryMessage,
					phase: "kickoff_session",
					energy: "STEADY",
				});
				setPendingKickoffSuggestion({ status: "error" });
			}
		})();
	}, [
		kickoffEligible,
		sessions,
		sessionEnergyPending,
		pendingKickoffSuggestion.status,
		tErrors,
	]);

	useEffect(() => {
		if (!sessionEnergyPending) {
			if (steeringAutoSkipTimerRef.current != null) {
				clearTimeout(steeringAutoSkipTimerRef.current);
				steeringAutoSkipTimerRef.current = null;
			}
			return;
		}

		steeringAutoSkipTimerRef.current = setTimeout(() => {
			steeringAutoSkipTimerRef.current = null;
			prefetchKickoffSteeringDefault();
		}, 1_000);

		return () => {
			if (steeringAutoSkipTimerRef.current != null) {
				clearTimeout(steeringAutoSkipTimerRef.current);
				steeringAutoSkipTimerRef.current = null;
			}
		};
	}, [sessionEnergyPending, prefetchKickoffSteeringDefault]);

	const dismissPreFocus = useCallback(() => {
		if (
			hasPreFocusedSuggestion &&
			pendingSuggestion.status === "ready" &&
			preFocusedTask != null
		) {
			void recordSuggestionDecision(
				pendingSuggestion.data.taskId,
				preFocusedTask.id,
			);
		}
		if (
			hasPreFocusedKickoff &&
			pendingKickoffSuggestion.status === "ready" &&
			preFocusedTask != null
		) {
			void recordKickoffDecision(
				pendingKickoffSuggestion.data.taskId,
				preFocusedTask.id,
			);
		}
		setPreFocusedTask(null);
		setHasPreFocusedSuggestion(false);
		setHasPreFocusedKickoff(false);
		setStagedKickoffDurationSec(null);
		setFocusedTaskId(null);
		setFocusedTask(null);
	}, [
		hasPreFocusedSuggestion,
		hasPreFocusedKickoff,
		pendingSuggestion,
		pendingKickoffSuggestion,
		preFocusedTask,
		recordSuggestionDecision,
		recordKickoffDecision,
	]);

	const selectTask = useCallback(
		(taskId: DomainTaskId, task?: FocusedTask) => {
			const breakRunning = state === "running" && isBreakKind(cycleKind);

			if (!breakRunning && (state === "running" || state === "completed")) {
				return;
			}

			setError(null);

			if (
				breakRunning &&
				pendingSuggestion.status === "ready" &&
				taskId !== pendingSuggestion.data.taskId
			) {
				void recordSuggestionDecision(pendingSuggestion.data.taskId, taskId);
				showOverrideAck();
				setSuggestedTaskId(null);
				setHasPreFocusedSuggestion(false);
			}

			if (
				!breakRunning &&
				state === "idle" &&
				pendingKickoffSuggestion.status === "ready" &&
				taskId !== pendingKickoffSuggestion.data.taskId
			) {
				void recordKickoffDecision(
					pendingKickoffSuggestion.data.taskId,
					taskId,
				);
				showOverrideAck();
				setKickoffSuggestedTaskId(null);
				setHasPreFocusedKickoff(false);
			}

			if (breakRunning && pendingSuggestion.status === "loading") {
				return;
			}

			if (!breakRunning && pendingKickoffSuggestion.status === "loading") {
				return;
			}

			clearKickoffIdleFlags();
			preFocusTask(taskId, task);
		},
		[
			state,
			cycleKind,
			pendingSuggestion,
			pendingKickoffSuggestion,
			recordSuggestionDecision,
			recordKickoffDecision,
			preFocusTask,
			showOverrideAck,
			clearKickoffIdleFlags,
		],
	);

	const acceptSuggestion = useCallback(() => {
		if (pendingSuggestion.status !== "ready") {
			return;
		}

		const { data } = pendingSuggestion;
		const activeIds = activeTaskIdsRef.current;
		if (activeIds != null && !activeIds.has(data.taskId)) {
			return;
		}

		setError(null);
		preFocusTask(data.taskId, {
			id: data.taskId,
			title: data.title,
		});
		setHasPreFocusedSuggestion(true);
		void recordSuggestionDecision(data.taskId, data.taskId);
	}, [pendingSuggestion, preFocusTask, recordSuggestionDecision]);

	const acceptKickoffSuggestion = useCallback(() => {
		if (pendingKickoffSuggestion.status !== "ready") {
			return;
		}

		const { data } = pendingKickoffSuggestion;
		const activeIds = activeTaskIdsRef.current;
		if (activeIds != null && !activeIds.has(data.taskId)) {
			return;
		}

		setError(null);
		preFocusTask(data.taskId, {
			id: data.taskId,
			title: data.title,
		});
		setHasPreFocusedKickoff(true);
		clearKickoffIdleFlags();
		void recordKickoffDecision(data.taskId, data.taskId);
	}, [
		pendingKickoffSuggestion,
		preFocusTask,
		recordKickoffDecision,
		clearKickoffIdleFlags,
	]);

	const selectKickoffDuration = useCallback(
		(
			workType: KickoffSuggestionResult["workType"],
			sec: number,
			scope: OnboardingScope,
		) => {
			setStagedKickoffDurationSec(sec);
			setWorkTypeDuration(workType, sec, scope);
		},
		[],
	);

	const clearTask = useCallback(() => {
		if (state === "running" || state === "completed") {
			return;
		}
		setFocusedTaskId(null);
		setFocusedTask(null);
	}, [state]);

	const start = useCallback(
		async (durationSec: number) => {
			const effectiveDurationSec = stagedKickoffDurationSec ?? durationSec;

			setError(null);
			setCatchUp(null);
			stopCycleEndTabPulse();
			tabWasHiddenWhileRunningRef.current = false;
			clearSuggestion();
			clearKickoffSuggestion();
			clearKickoffIdleFlags();
			setPreFocusedTask(null);
			setStagedKickoffDurationSec(null);

			if (state !== "idle") {
				setError(tErrors("cycleInProgress"));
				return;
			}

			if (focusedTaskId == null) {
				setError(tErrors("noTaskSelected"));
				return;
			}

			const firstCycleIntention =
				completedWorkCycles === 0 && sessionIntention != null
					? sessionIntention
					: undefined;

			const rollbackOptimisticStart = () => {
				pendingCreateRef.current = null;
				stopWorker();
				endTimeRef.current = null;
				setState("idle");
				stateRef.current = "idle";
				setRemainingMs(0);
				setActiveCycle(null);
				activeCycleRef.current = null;
				setCycleKind(null);
				cycleKindRef.current = null;
			};

			let optimisticEndTime = 0;
			const useOptimisticStart = mode === "authenticated";

			if (useOptimisticStart) {
				try {
					await audioRef.current.unlock();
					await audioRef.current.preload(POMODORO_ALARM_URL);
				} catch {
					// Audio is best-effort; cycle start must not depend on it.
				}

				const startedAt = new Date();
				optimisticEndTime = startedAt.getTime() + effectiveDurationSec * 1000;
				cancelPendingStartRef.current = false;

				const optimisticCycle: DomainActiveCycle = {
					id: allocateOptimisticCycleId(),
					sessionId: _activeSessionId ?? -1,
					userId: "",
					taskId: focusedTaskId,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: effectiveDurationSec,
					startedAt,
					endedAt: null,
					task: focusedTask,
				};

				setActiveCycle(optimisticCycle);
				activeCycleRef.current = optimisticCycle;
				setCycleKind("WORK");
				cycleKindRef.current = "WORK";
				setState("running");
				stateRef.current = "running";
				startWorker(optimisticEndTime);
				setLastDuration(effectiveDurationSec);
			}

			try {
				if (!useOptimisticStart) {
					try {
						await audioRef.current.unlock();
						await audioRef.current.preload(POMODORO_ALARM_URL);
					} catch {
						// Audio is best-effort; cycle start must not depend on it.
					}
				}

				const session = await sessions.getOrCreateActive();

				if (cancelPendingStartRef.current) {
					return;
				}

				// Reset completed count when server assigns a different session
				if (session.id !== _activeSessionId) {
					if (_activeSessionId != null && stateRef.current === "idle") {
						await maybePresentTimeoutClosure(_activeSessionId);
					}
					setCompletedWorkCycles(0);
					setSessionIntention(null);
					setNarrativeTasksCompleted(0);
					setNarrativeLatestEnergy(null);
				}

				setActiveSessionId(session.id);
				setHasActiveSession(true);

				const createCall = cycles.create({
					kind: "WORK",
					configuredDurationSec: effectiveDurationSec,
					taskId: focusedTaskId,
					...(firstCycleIntention != null
						? { intention: firstCycleIntention }
						: {}),
				});
				pendingCreateRef.current = createCall;

				let cycle: CreatedActiveCycle;
				try {
					cycle = await createCall;
				} catch (createError) {
					pendingCreateRef.current = null;
					throw createError;
				}

				if (cancelPendingStartRef.current) {
					pendingCreateRef.current = null;
					await cycles.interrupt({ cycleId: cycle.id });
					await invalidateServerCycle();
					return;
				}

				const endTime = cycleEndTimeMs(cycle);

				const reconciledCycle: DomainActiveCycle = {
					...cycle,
					task: focusedTask,
				};

				setActiveCycle(reconciledCycle);
				activeCycleRef.current = reconciledCycle;
				pendingCreateRef.current = null;
				setCycleKind("WORK");
				cycleKindRef.current = "WORK";

				if (useOptimisticStart) {
					if (Math.abs(endTime - optimisticEndTime) > 2000) {
						startWorker(endTime);
					}
				} else {
					setState("running");
					stateRef.current = "running";
					startWorker(endTime);
					setLastDuration(effectiveDurationSec);
				}

				await invalidateServerCycle();
			} catch {
				if (useOptimisticStart) {
					rollbackOptimisticStart();
				}
				setError(tErrors("startFailed"));
			}
		},
		[
			state,
			focusedTaskId,
			focusedTask,
			_activeSessionId,
			stagedKickoffDurationSec,
			mode,
			sessions,
			cycles,
			startWorker,
			stopWorker,
			invalidateServerCycle,
			clearSuggestion,
			clearKickoffSuggestion,
			clearKickoffIdleFlags,
			completedWorkCycles,
			sessionIntention,
			maybePresentTimeoutClosure,
			tErrors,
		],
	);

	const resolvePersistedCycleId =
		useCallback(async (): Promise<DomainTaskId | null> => {
			let cycle = activeCycleRef.current;
			if (cycle == null) {
				return null;
			}

			if (
				mode === "authenticated" &&
				typeof cycle.id === "number" &&
				cycle.id < 0 &&
				pendingCreateRef.current != null
			) {
				try {
					await pendingCreateRef.current;
				} catch {
					return null;
				}
				cycle = activeCycleRef.current;
			}

			if (cycle == null) {
				return null;
			}

			if (
				mode === "authenticated" &&
				typeof cycle.id === "number" &&
				cycle.id < 0
			) {
				return null;
			}

			return cycle.id;
		}, [mode]);

	const interrupt = useCallback(async () => {
		if (activeCycle == null) {
			return;
		}

		const cycleId = activeCycle.id;
		const isOptimisticCycle =
			mode === "authenticated" && typeof cycleId === "number" && cycleId < 0;

		if (isOptimisticCycle) {
			cancelPendingStartRef.current = true;
		}

		const savedEndTime = endTimeRef.current;

		setError(null);
		stopWorker();
		endTimeRef.current = null;
		clearSuggestion();

		const interruptSnapshot =
			mode === "authenticated"
				? {
						activeCycle,
						state,
						cycleKind,
						remainingMs,
						endTime: savedEndTime,
					}
				: null;

		if (mode === "authenticated") {
			setState("idle");
			stateRef.current = "idle";
			setRemainingMs(0);
			setActiveCycle(null);
			setCycleKind(null);
			cycleKindRef.current = null;
		}

		if (isOptimisticCycle) {
			return;
		}

		try {
			await cycles.interrupt({ cycleId });

			if (mode !== "authenticated") {
				setState("idle");
				stateRef.current = "idle";
				setRemainingMs(0);
				setActiveCycle(null);
				setCycleKind(null);
				cycleKindRef.current = null;
			}

			await invalidateServerCycle();
		} catch {
			if (interruptSnapshot != null) {
				setActiveCycle(interruptSnapshot.activeCycle);
				setState(interruptSnapshot.state);
				stateRef.current = interruptSnapshot.state;
				setCycleKind(interruptSnapshot.cycleKind);
				cycleKindRef.current = interruptSnapshot.cycleKind;
				setRemainingMs(interruptSnapshot.remainingMs);
				if (interruptSnapshot.endTime != null) {
					endTimeRef.current = interruptSnapshot.endTime;
					startWorker(interruptSnapshot.endTime);
				}
			}
			setError(tErrors("interruptFailed"));
		}
	}, [
		activeCycle,
		cycleKind,
		cycles,
		invalidateServerCycle,
		mode,
		remainingMs,
		startWorker,
		state,
		stopWorker,
		clearSuggestion,
		tErrors,
	]);

	const pause = useCallback(async () => {
		if (activeCycle == null || state !== "running") {
			return;
		}

		clearBreakTransitionLine();

		const savedEndTime = endTimeRef.current;
		const frozenRemainingMs =
			savedEndTime != null
				? Math.max(0, savedEndTime - Date.now())
				: remainingMs;
		const remainingDurationSec = Math.max(
			0,
			Math.ceil(frozenRemainingMs / 1000),
		);

		setError(null);
		stopWorker();
		endTimeRef.current = null;

		const pauseSnapshot = {
			activeCycle,
			state,
			cycleKind,
			remainingMs: frozenRemainingMs,
			endTime: savedEndTime,
		};

		if (mode === "authenticated") {
			setState("paused");
			stateRef.current = "paused";
			setRemainingMs(frozenRemainingMs);
			setActiveCycle({
				...activeCycle,
				state: "PAUSED",
				pausedAt: new Date(),
				remainingDurationSec,
			});
		}

		try {
			const cycleId = await resolvePersistedCycleId();
			if (cycleId == null) {
				throw new Error("Cycle not persisted");
			}

			const updated = await cycles.pause({ cycleId, remainingDurationSec });
			setActiveCycle(updated);
			if (mode !== "authenticated") {
				setState("paused");
				stateRef.current = "paused";
				setRemainingMs(frozenRemainingMs);
			}
			await invalidateServerCycle();
		} catch {
			setActiveCycle(pauseSnapshot.activeCycle);
			activeCycleRef.current = pauseSnapshot.activeCycle;
			setState(pauseSnapshot.state);
			stateRef.current = pauseSnapshot.state;
			setCycleKind(pauseSnapshot.cycleKind);
			cycleKindRef.current = pauseSnapshot.cycleKind;
			setRemainingMs(pauseSnapshot.remainingMs);
			if (pauseSnapshot.endTime != null) {
				endTimeRef.current = pauseSnapshot.endTime;
				startWorker(pauseSnapshot.endTime);
			}
			setError(tErrors("pauseFailed"));
		}
	}, [
		activeCycle,
		cycleKind,
		cycles,
		invalidateServerCycle,
		mode,
		remainingMs,
		startWorker,
		state,
		stopWorker,
		resolvePersistedCycleId,
		clearBreakTransitionLine,
		tErrors,
	]);

	const resume = useCallback(async () => {
		if (activeCycle == null || state !== "paused") {
			return;
		}

		const frozenRemainingMs =
			activeCycle.remainingDurationSec != null
				? activeCycle.remainingDurationSec * 1000
				: remainingMs;
		const newEndTime = Date.now() + frozenRemainingMs;

		const resumeSnapshot =
			mode === "authenticated"
				? {
						activeCycle,
						state,
						cycleKind,
						remainingMs,
						endTime: endTimeRef.current,
					}
				: null;

		setError(null);

		if (mode === "authenticated") {
			setState("running");
			stateRef.current = "running";
			endTimeRef.current = newEndTime;
			setRemainingMs(frozenRemainingMs);
			startWorker(newEndTime);
			setActiveCycle({
				...activeCycle,
				state: "RUNNING",
				pausedAt: null,
				remainingDurationSec: null,
				startedAt: new Date(),
			});
		}

		try {
			const cycleId = await resolvePersistedCycleId();
			if (cycleId == null) {
				throw new Error("Cycle not persisted");
			}

			const updated = await cycles.resume({ cycleId });
			setActiveCycle(updated);
			if (mode !== "authenticated") {
				setState("running");
				stateRef.current = "running";
				endTimeRef.current = newEndTime;
				setRemainingMs(frozenRemainingMs);
				startWorker(newEndTime);
			} else {
				endTimeRef.current = newEndTime;
				startWorker(newEndTime);
			}
			await invalidateServerCycle();
		} catch {
			if (resumeSnapshot != null) {
				setActiveCycle(resumeSnapshot.activeCycle);
				setState(resumeSnapshot.state);
				stateRef.current = resumeSnapshot.state;
				setCycleKind(resumeSnapshot.cycleKind);
				setRemainingMs(resumeSnapshot.remainingMs);
				endTimeRef.current = null;
				stopWorker();
			}
			setError(tErrors("resumeFailed"));
		}
	}, [
		activeCycle,
		cycleKind,
		cycles,
		invalidateServerCycle,
		mode,
		remainingMs,
		startWorker,
		state,
		stopWorker,
		resolvePersistedCycleId,
		tErrors,
	]);

	const startBreakAfterWorkComplete = useCallback(
		async (markTaskDone: boolean) => {
			const newCount = completedWorkCycles + 1;
			setCompletedWorkCycles(newCount);

			const breakKind: CycleKind =
				newCount % 4 === 0 ? "LONG_BREAK" : "SHORT_BREAK";
			const breakDuration =
				breakKind === "LONG_BREAK"
					? getLongBreakDuration()
					: getShortBreakDuration();

			const breakCycle = await cycles.create({
				kind: breakKind,
				configuredDurationSec: breakDuration,
			});

			const endTime = cycleEndTimeMs(breakCycle);

			setActiveCycle({ ...breakCycle, task: null });
			setCycleKind(breakKind);
			cycleKindRef.current = breakKind;
			setState("running");
			stateRef.current = "running";
			startWorker(endTime);
			fireBreakOutOfTabAlert(breakKind, breakCycle.id);
			showBreakTransitionLine(breakKind);

			await Promise.all([
				invalidateServerCycle(),
				invalidateDayPlan(),
				invalidateDailyRecap(),
				...(markTaskDone ? [utils.task.list.invalidate()] : []),
			]);

			if (_activeSessionId != null) {
				void refreshNarrativeStats(_activeSessionId);
			}
		},
		[
			completedWorkCycles,
			cycles,
			invalidateDailyRecap,
			invalidateDayPlan,
			invalidateServerCycle,
			startWorker,
			fireBreakOutOfTabAlert,
			showBreakTransitionLine,
			utils.task.list,
			_activeSessionId,
			refreshNarrativeStats,
		],
	);

	const completeWorkCycleOnly = useCallback(
		async (markTaskDone: boolean): Promise<boolean> => {
			if (activeCycle == null) {
				return false;
			}

			setError(null);

			let cycleId: DomainTaskId;
			try {
				cycleId = await resolvePersistableCycleId();
			} catch {
				setError(tErrors("completionSaveFailed"));
				return false;
			}

			try {
				await retryOnce(() =>
					cycles.complete(
						withWorkDayPlanKey(
							{
								cycleId,
								markTaskDone,
								...(pendingIncrementInterruptionRef.current
									? { incrementInterruption: true }
									: {}),
							},
							{ kind: "WORK", mode },
						),
					),
				);
			} catch {
				setError(tErrors("completionSaveFailed"));
				return false;
			}

			pendingIncrementInterruptionRef.current = false;

			stopWorker();
			endTimeRef.current = null;

			setCompletedWorkCycles((count) => count + 1);
			setState("idle");
			setRemainingMs(0);
			setActiveCycle(null);
			setCycleKind(null);

			await Promise.all([
				invalidateServerCycle(),
				invalidateDayPlan(),
				invalidateDailyRecap(),
				...(markTaskDone ? [utils.task.list.invalidate()] : []),
			]);

			if (_activeSessionId != null) {
				void refreshNarrativeStats(_activeSessionId);
			}

			return true;
		},
		[
			activeCycle,
			cycles,
			invalidateDailyRecap,
			invalidateDayPlan,
			invalidateServerCycle,
			mode,
			resolvePersistableCycleId,
			stopWorker,
			utils.task.list,
			_activeSessionId,
			refreshNarrativeStats,
			tErrors,
		],
	);

	const confirmComplete = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			setError(null);

			const currentKind = activeCycle.kind;

			let cycleId: DomainTaskId;
			try {
				cycleId = await resolvePersistableCycleId();
			} catch {
				setError(tErrors("completionSaveFailed"));
				return;
			}

			try {
				await retryOnce(() =>
					cycles.complete(
						withWorkDayPlanKey(
							{
								cycleId,
								markTaskDone,
								...(pendingIncrementInterruptionRef.current
									? { incrementInterruption: true }
									: {}),
							},
							{ kind: currentKind, mode },
						),
					),
				);
			} catch {
				setError(tErrors("completionSaveFailed"));
				return;
			}

			pendingIncrementInterruptionRef.current = false;

			stopWorker();
			endTimeRef.current = null;

			if (currentKind === "WORK") {
				try {
					await startBreakAfterWorkComplete(markTaskDone);
				} catch {
					setError(tErrors("breakStartFailed"));
					setState("idle");
					setRemainingMs(0);
					setActiveCycle(null);
					setCycleKind(null);
					setFocusedTaskId(null);
					setFocusedTask(null);
				}
			} else {
				clearBreakTransitionLine();
				const keptFocus = preFocusedTask;

				setState("idle");
				setRemainingMs(0);
				setActiveCycle(null);
				setCycleKind(null);
				setPreFocusedTask(null);
				setHasPreFocusedSuggestion(false);

				if (keptFocus != null) {
					setFocusedTaskId(keptFocus.id);
					setFocusedTask(keptFocus);
				} else {
					setFocusedTaskId(null);
					setFocusedTask(null);
					setPostBreakIdleFlag(true);
				}

				clearSuggestion();

				await Promise.all([
					invalidateServerCycle(),
					utils.task.list.invalidate(),
				]);
			}
		},
		[
			activeCycle,
			cycles,
			invalidateServerCycle,
			mode,
			resolvePersistableCycleId,
			startBreakAfterWorkComplete,
			stopWorker,
			utils.task.list,
			preFocusedTask,
			clearSuggestion,
			clearBreakTransitionLine,
			tErrors,
		],
	);

	// NFR 200ms: authenticated wedge check-in → break/suggestion (S-34); start/interrupt (B-03).
	// S-34 / L-04: authenticated wedge optimism — each tap surface needs a deferred-mock oracle in tests.
	const captureWedgeTransitionSnapshot =
		useCallback((): WedgeTransitionSnapshot => {
			return {
				awaitingCheckIn: awaitingCheckInRef.current,
				pendingMarkTaskDone,
				activeCycle: activeCycleRef.current,
				state: stateRef.current,
				cycleKind: cycleKindRef.current,
				remainingMs,
				endTime: endTimeRef.current,
				completedWorkCycles,
			};
		}, [completedWorkCycles, pendingMarkTaskDone, remainingMs]);

	const rollbackOptimisticCheckInTransition = useCallback(
		(snapshot: WedgeTransitionSnapshot) => {
			// S-35: callers must prefer partial-failure paths over rollback when server
			// already persisted check-in/work — see continueAfterCheckIn async chain.
			pendingBreakCreateRef.current = null;
			stopWorker();
			endTimeRef.current = snapshot.endTime;
			setCompletedWorkCycles(snapshot.completedWorkCycles);
			setActiveCycle(snapshot.activeCycle);
			activeCycleRef.current = snapshot.activeCycle;
			setState(snapshot.state);
			stateRef.current = snapshot.state;
			setCycleKind(snapshot.cycleKind);
			cycleKindRef.current = snapshot.cycleKind;
			setRemainingMs(snapshot.remainingMs);
			if (snapshot.endTime != null && snapshot.state === "running") {
				startWorker(snapshot.endTime);
			}
			setAwaitingCheckIn(snapshot.awaitingCheckIn);
			setPendingMarkTaskDone(snapshot.pendingMarkTaskDone);
			clearBreakTransitionLine();
		},
		[startWorker, stopWorker, clearBreakTransitionLine],
	);

	const continueAfterCheckIn = useCallback(
		async (
			markTaskDone: boolean,
			workCycleId: number,
			options?: {
				checkInAlreadySaved?: boolean;
				energy?: "FOCUSED" | "STEADY" | "FADING";
			},
		) => {
			clearKickoffSuggestion();
			clearKickoffIdleFlags();
			if (options?.energy != null) {
				setNarrativeLatestEnergy(options.energy);
			}
			const gen = ++suggestionFetchGenRef.current;
			suggestionCycleIdRef.current = workCycleId;
			setPendingSuggestion({ status: "loading" });
			setSuggestionCycleId(workCycleId);
			setSuggestedTaskId(null);
			setHasPreFocusedSuggestion(false);

			if (mode !== "authenticated") {
				setIsPostCheckInTransitioning(true);
				const endSuggestionFetch = beginSuggestionFetch();
				try {
					await confirmComplete(markTaskDone);
					const breakStarted =
						stateRef.current === "running" &&
						(cycleKindRef.current === "SHORT_BREAK" ||
							cycleKindRef.current === "LONG_BREAK");
					if (breakStarted) {
						setAwaitingCheckIn(false);
						setPendingMarkTaskDone(null);
					}
					await fetchPostCheckInSuggestion(workCycleId, gen);
				} catch {
					if (suggestionFetchGenRef.current !== gen) {
						return;
					}
					if (suggestionCycleIdRef.current !== workCycleId) {
						return;
					}
					setPendingSuggestion({ status: "error" });
					setSuggestedTaskId(null);
				} finally {
					setIsPostCheckInTransitioning(false);
					endSuggestionFetch();
				}
				return;
			}

			const snapshot = captureWedgeTransitionSnapshot();
			setIsPostCheckInTransitioning(true);

			const { newCount, breakKind, breakDurationSec } =
				computeBreakAfterWork(completedWorkCycles);
			const startedAt = new Date();
			const optimisticEndTime = startedAt.getTime() + breakDurationSec * 1000;
			const optimisticBreakCycle: DomainActiveCycle = {
				id: allocateOptimisticCycleId(),
				sessionId: _activeSessionId ?? -1,
				userId: "",
				taskId: null,
				kind: breakKind,
				state: "RUNNING",
				configuredDurationSec: breakDurationSec,
				startedAt,
				endedAt: null,
				task: null,
			};

			stopWorker();
			endTimeRef.current = null;
			setCompletedWorkCycles(newCount);
			setActiveCycle(optimisticBreakCycle);
			activeCycleRef.current = optimisticBreakCycle;
			setCycleKind(breakKind);
			cycleKindRef.current = breakKind;
			setState("running");
			stateRef.current = "running";
			startWorker(optimisticEndTime);
			fireBreakOutOfTabAlert(breakKind, optimisticBreakCycle.id);
			showBreakTransitionLine(breakKind);
			setAwaitingCheckIn(false);
			setPendingMarkTaskDone(null);
			setIsPostCheckInTransitioning(false);

			const endSuggestionFetch = beginSuggestionFetch();
			const checkInAlreadySaved = options?.checkInAlreadySaved ?? false;
			const energy = options?.energy;

			void (async () => {
				let failurePhase: WedgeSyncPhase = "check_in";
				let failureMessage = tErrors("breakStartFailed");
				try {
					if (!checkInAlreadySaved) {
						failurePhase = "check_in";
						if (energy == null) {
							throw new Error("Missing check-in energy for post-check-in path");
						}
						try {
							await createCheckIn.mutateAsync({
								cycleId: workCycleId,
								energy,
							});
						} catch {
							failureMessage = tErrors("checkInSaveFailed");
							throw new Error("check-in-failed");
						}
					}

					failurePhase = "complete_work";
					await retryOnce(() =>
						cycles.complete(
							withWorkDayPlanKey(
								{
									cycleId: workCycleId,
									markTaskDone,
									...(pendingIncrementInterruptionRef.current
										? { incrementInterruption: true }
										: {}),
								},
								{ kind: "WORK", mode },
							),
						),
					);
					pendingIncrementInterruptionRef.current = false;

					failurePhase = "start_break";
					const createCall = cycles.create({
						kind: breakKind,
						configuredDurationSec: breakDurationSec,
					});
					pendingBreakCreateRef.current = createCall;
					let breakCycle: CreatedActiveCycle;
					try {
						breakCycle = await createCall;
					} catch (createError) {
						pendingBreakCreateRef.current = null;
						throw createError;
					}
					pendingBreakCreateRef.current = null;

					const endTime = cycleEndTimeMs(breakCycle);
					const reconciledBreak: DomainActiveCycle = {
						...breakCycle,
						task: null,
					};
					setActiveCycle(reconciledBreak);
					activeCycleRef.current = reconciledBreak;
					setCycleKind(breakKind);
					cycleKindRef.current = breakKind;
					if (Math.abs(endTime - optimisticEndTime) > 2000) {
						startWorker(endTime);
					}

					await Promise.all([
						invalidateServerCycle(),
						invalidateDayPlan(),
						invalidateDailyRecap(),
						...(markTaskDone ? [utils.task.list.invalidate()] : []),
					]);

					if (_activeSessionId != null) {
						void refreshNarrativeStats(_activeSessionId);
					}

					failurePhase = "suggestion_fetch";
					await fetchPostCheckInSuggestion(workCycleId, gen);
					pendingWedgeIntentRef.current = null;
					setPendingWedgeRecovery(null);
				} catch {
					if (suggestionFetchGenRef.current !== gen) {
						return;
					}
					if (suggestionCycleIdRef.current !== workCycleId) {
						return;
					}
					if (energy == null) {
						rollbackOptimisticCheckInTransition(snapshot);
						setPendingSuggestion({ status: "error" });
						setSuggestedTaskId(null);
						setError(failureMessage);
						return;
					}

					const wedgeIntent: PendingWedgeIntent = {
						phase: failurePhase,
						energy,
						markTaskDone,
						workCycleId,
						breakKind,
						breakDurationSec,
					};
					pendingWedgeIntentRef.current = wedgeIntent;
					setPendingWedgeRecovery({
						message: failureMessage,
						phase: failurePhase,
						energy,
					});
					setPendingSuggestion({ status: "error" });
					setSuggestedTaskId(null);
					setError(failureMessage);

					if (
						failurePhase === "suggestion_fetch" ||
						failurePhase === "start_break"
					) {
						if (failurePhase === "suggestion_fetch") {
							setError(tErrors("suggestionLoadBreakRunning"));
							setPendingWedgeRecovery({
								message: tErrors("suggestionLoadBreakRunning"),
								phase: failurePhase,
								energy,
							});
						}
						return;
					}

					rollbackOptimisticCheckInTransition(snapshot);
					if (failurePhase === "check_in") {
						setAwaitingCheckIn(true);
					}
				} finally {
					endSuggestionFetch();
				}
			})();
		},
		[
			mode,
			confirmComplete,
			fetchPostCheckInSuggestion,
			clearKickoffSuggestion,
			clearKickoffIdleFlags,
			captureWedgeTransitionSnapshot,
			completedWorkCycles,
			_activeSessionId,
			stopWorker,
			startWorker,
			createCheckIn,
			cycles,
			invalidateDailyRecap,
			invalidateDayPlan,
			invalidateServerCycle,
			utils.task.list,
			refreshNarrativeStats,
			rollbackOptimisticCheckInTransition,
			fireBreakOutOfTabAlert,
			showBreakTransitionLine,
			tErrors,
		],
	);

	const retryBreakCreateAfterCheckIn = useCallback(
		async (intent: PendingWedgeIntent) => {
			if (
				intent.breakKind == null ||
				intent.breakDurationSec == null ||
				intent.workCycleId == null
			) {
				throw new Error("Missing break metadata for wedge retry");
			}
			const workCycleId = intent.workCycleId;
			const gen = suggestionFetchGenRef.current;
			const endSuggestionFetch = beginSuggestionFetch();
			const failureMessage = tErrors("breakStartFailed");
			try {
				const createCall = cycles.create({
					kind: intent.breakKind,
					configuredDurationSec: intent.breakDurationSec,
				});
				pendingBreakCreateRef.current = createCall;
				let breakCycle: CreatedActiveCycle;
				try {
					breakCycle = await createCall;
				} catch (createError) {
					pendingBreakCreateRef.current = null;
					throw createError;
				}
				pendingBreakCreateRef.current = null;

				const endTime = cycleEndTimeMs(breakCycle);
				const reconciledBreak: DomainActiveCycle = {
					...breakCycle,
					task: null,
				};
				setActiveCycle(reconciledBreak);
				activeCycleRef.current = reconciledBreak;
				setCycleKind(intent.breakKind);
				cycleKindRef.current = intent.breakKind;
				startWorker(endTime);

				await Promise.all([
					invalidateServerCycle(),
					invalidateDayPlan(),
					invalidateDailyRecap(),
					...(intent.markTaskDone ? [utils.task.list.invalidate()] : []),
				]);

				await fetchPostCheckInSuggestion(workCycleId, gen);
				pendingWedgeIntentRef.current = null;
				setPendingWedgeRecovery(null);
				setError(null);
			} catch {
				if (suggestionFetchGenRef.current !== gen) {
					return;
				}
				if (suggestionCycleIdRef.current !== workCycleId) {
					return;
				}
				pendingWedgeIntentRef.current = { ...intent, phase: "start_break" };
				setPendingWedgeRecovery({
					message: failureMessage,
					phase: "start_break",
					energy: intent.energy,
				});
				setPendingSuggestion({ status: "error" });
				setSuggestedTaskId(null);
				setError(failureMessage);
			} finally {
				endSuggestionFetch();
			}
		},
		[
			cycles,
			fetchPostCheckInSuggestion,
			invalidateDailyRecap,
			invalidateDayPlan,
			invalidateServerCycle,
			startWorker,
			utils.task.list,
			tErrors,
		],
	);

	const onMidCycleMarkComplete = useCallback(
		(taskId: DomainTaskId, task: FocusedTask) => {
			if (state !== "running" || cycleKind !== "WORK" || activeCycle == null) {
				return;
			}
			setError(null);
			setMidCyclePendingTask(task ?? { id: taskId, title: "" });
		},
		[state, cycleKind, activeCycle],
	);

	const onMidCycleContinueWithTask = useCallback(
		async (
			nextTaskId: DomainTaskId,
			nextTask: FocusedTask,
			resumeNote: string | null = null,
		) => {
			if (midCyclePendingTask == null || activeCycle == null) {
				return;
			}

			setIsMidCycleSubmitting(true);
			setError(null);

			try {
				const cycleId = await resolvePersistableCycleId();
				await tasks.update({
					id: midCyclePendingTask.id,
					status: "completed",
				});
				if (resumeNote != null && resumeNote.length > 0) {
					await tasks.update({
						id: nextTaskId,
						resumeNote,
					});
				}
				const rebound = await cycles.rebindTask({
					cycleId,
					taskId: nextTaskId,
				});
				const updatedCycle: DomainActiveCycle = {
					...activeCycle,
					id: cycleId,
					taskId: nextTaskId,
					task: nextTask ?? rebound.task,
				};
				setActiveCycle(updatedCycle);
				activeCycleRef.current = updatedCycle;
				setFocusedTaskId(nextTaskId);
				setFocusedTask(nextTask ?? rebound.task);
				setMidCyclePendingTask(null);

				await Promise.all([
					invalidateServerCycle(),
					utils.task.list.invalidate(),
				]);
			} catch {
				setError(tErrors("switchTaskFailed"));
			} finally {
				setIsMidCycleSubmitting(false);
			}
		},
		[
			midCyclePendingTask,
			activeCycle,
			tasks,
			cycles,
			invalidateServerCycle,
			resolvePersistableCycleId,
			utils.task.list,
			tErrors,
		],
	);

	const onCycleCompleteConfirm = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			setError(null);

			const currentKind = activeCycle.kind;

			if (currentKind !== "WORK" || mode === "guest") {
				setIsConfirming(true);
				try {
					await confirmComplete(markTaskDone);
				} finally {
					setIsConfirming(false);
				}
				return;
			}

			setPendingMarkTaskDone(markTaskDone);
			setAwaitingCheckIn(true);
		},
		[activeCycle, mode, confirmComplete],
	);

	const submitCheckIn = useCallback(
		async (energy: "FOCUSED" | "STEADY" | "FADING") => {
			if (activeCycle == null || pendingMarkTaskDone === null) {
				return;
			}

			setError(null);

			const markTaskDone = pendingMarkTaskDone;

			let workCycleId: number;
			try {
				workCycleId = await resolveServerCycleId();
			} catch {
				setError(tErrors("checkInSaveFailed"));
				return;
			}

			if (mode !== "guest") {
				try {
					const session = await sessions.getOrCreateActive();
					const cyclesAtCheckIn =
						effectiveWorkCyclesAtCheckIn(completedWorkCycles);

					if (
						shouldShowWindDownNudge({
							energy,
							completedWorkCycles: cyclesAtCheckIn,
							interruptionCount: session.interruptionCount,
							dismissed: windDownDismissed,
						})
					) {
						setIsConfirming(true);
						try {
							await createCheckIn.mutateAsync({
								cycleId: workCycleId,
								energy,
							});
							pendingWindDownMarkTaskDoneRef.current = markTaskDone;
							pendingWindDownWorkCycleIdRef.current = workCycleId;
							setWindDownRationale(
								buildWindDownRationale({
									energy,
									completedWorkCycles,
									interruptionCount: session.interruptionCount,
									dismissed: windDownDismissed,
								}),
							);
							setAwaitingCheckIn(false);
							setPendingMarkTaskDone(null);
							setAwaitingWindDown(true);
						} catch {
							const recoveryMessage = tErrors("checkInSaveFailed");
							pendingWedgeIntentRef.current = {
								phase: "check_in",
								energy,
								markTaskDone,
								workCycleId,
							};
							setPendingWedgeRecovery({
								message: recoveryMessage,
								phase: "check_in",
								energy,
							});
							setError(recoveryMessage);
						} finally {
							setIsConfirming(false);
						}
						return;
					}
				} catch {
					// Wind-down is optional; never block check-in → break transition.
				}
			}

			if (mode === "authenticated") {
				await continueAfterCheckIn(markTaskDone, workCycleId, { energy });
				if (_activeSessionId != null) {
					void refreshNarrativeStats(_activeSessionId);
				}
				return;
			}

			setIsConfirming(true);
			try {
				await createCheckIn.mutateAsync({
					cycleId: workCycleId,
					energy,
				});
				await continueAfterCheckIn(markTaskDone, workCycleId, {
					checkInAlreadySaved: true,
				});
				if (_activeSessionId != null) {
					void refreshNarrativeStats(_activeSessionId);
				}
			} catch {
				setError(tErrors("checkInSaveFailed"));
			} finally {
				setIsConfirming(false);
			}
		},
		[
			activeCycle,
			pendingMarkTaskDone,
			createCheckIn,
			mode,
			sessions,
			completedWorkCycles,
			windDownDismissed,
			continueAfterCheckIn,
			resolveServerCycleId,
			refreshNarrativeStats,
			_activeSessionId,
			tErrors,
		],
	);

	const retryWedgeSync = useCallback(async () => {
		const intent = pendingWedgeIntentRef.current;
		if (intent == null || isWedgeSyncRetryingRef.current) {
			return;
		}
		isWedgeSyncRetryingRef.current = true;
		setIsWedgeSyncRetrying(true);
		setError(null);
		try {
			switch (intent.phase) {
				case "check_in":
					await submitCheckIn(intent.energy);
					if (pendingWedgeIntentRef.current == null) {
						setCatchUp(null);
					}
					break;
				case "complete_work": {
					if (intent.markTaskDone == null || intent.workCycleId == null) {
						break;
					}
					await continueAfterCheckIn(intent.markTaskDone, intent.workCycleId, {
						energy: intent.energy,
						checkInAlreadySaved: true,
					});
					break;
				}
				case "start_break":
					await retryBreakCreateAfterCheckIn(intent);
					if (pendingWedgeIntentRef.current == null) {
						setCatchUp(null);
					}
					break;
				case "suggestion_fetch": {
					if (intent.workCycleId == null) {
						break;
					}
					const gen = suggestionFetchGenRef.current;
					const failureMessage = tErrors("suggestionLoadFailed");
					const endSuggestionFetch = beginSuggestionFetch();
					setPendingSuggestion({ status: "loading" });
					try {
						await fetchPostCheckInSuggestion(intent.workCycleId, gen);
						pendingWedgeIntentRef.current = null;
						setPendingWedgeRecovery(null);
						setError(null);
						setCatchUp(null);
					} catch {
						if (suggestionFetchGenRef.current !== gen) {
							return;
						}
						if (suggestionCycleIdRef.current !== intent.workCycleId) {
							return;
						}
						pendingWedgeIntentRef.current = intent;
						setPendingWedgeRecovery({
							message: failureMessage,
							phase: "suggestion_fetch",
							energy: intent.energy,
						});
						setPendingSuggestion({ status: "error" });
						setSuggestedTaskId(null);
					} finally {
						endSuggestionFetch();
					}
					break;
				}
				case "kickoff_session": {
					const failureMessage = tErrors("sessionStartFailed");
					try {
						const session = await sessions.getOrCreateActive();
						setActiveSessionId(session.id);
						setSessionEnergyPending(true);
						setPendingKickoffSuggestion({ status: "idle" });
						pendingWedgeIntentRef.current = null;
						setPendingWedgeRecovery(null);
						setCatchUp(null);
					} catch {
						pendingWedgeIntentRef.current = intent;
						setPendingWedgeRecovery({
							message: failureMessage,
							phase: "kickoff_session",
							energy: intent.energy,
						});
						setPendingKickoffSuggestion({ status: "error" });
					}
					break;
				}
				case "kickoff_suggestion": {
					const sessionId =
						intent.sessionId ??
						(_activeSessionId != null ? Number(_activeSessionId) : null);
					if (sessionId == null) {
						break;
					}
					fetchKickoffSuggestion(
						sessionId,
						intent.energy,
						intent.sessionIntention,
					);
					break;
				}
			}
		} finally {
			isWedgeSyncRetryingRef.current = false;
			setIsWedgeSyncRetrying(false);
		}
	}, [
		_activeSessionId,
		continueAfterCheckIn,
		fetchKickoffSuggestion,
		fetchPostCheckInSuggestion,
		retryBreakCreateAfterCheckIn,
		sessions,
		submitCheckIn,
		tErrors,
	]);

	const onMidCycleEndCycleAndBreak = useCallback(async () => {
		if (midCyclePendingTask == null || activeCycle == null) {
			return;
		}

		setIsMidCycleSubmitting(true);
		setError(null);

		stopWorker();
		endTimeRef.current = null;
		setMidCyclePendingTask(null);
		setState("completed");
		setRemainingMs(0);

		const currentKind = activeCycle.kind;

		if (currentKind !== "WORK" || mode === "guest") {
			try {
				const cycleId = await resolvePersistableCycleId();
				await retryOnce(() =>
					cycles.complete(
						withWorkDayPlanKey(
							{
								cycleId,
								markTaskDone: true,
							},
							{ kind: currentKind, mode },
						),
					),
				);
				await startBreakAfterWorkComplete(true);
			} catch {
				setError(tErrors("breakStartFailed"));
				setState("idle");
				setRemainingMs(0);
				setActiveCycle(null);
				setCycleKind(null);
				setFocusedTaskId(null);
				setFocusedTask(null);
			} finally {
				setIsMidCycleSubmitting(false);
			}
			return;
		}

		setPendingMarkTaskDone(true);
		pendingIncrementInterruptionRef.current = true;
		setAwaitingCheckIn(true);
		setIsMidCycleSubmitting(false);
	}, [
		midCyclePendingTask,
		activeCycle,
		mode,
		cycles,
		resolvePersistableCycleId,
		startBreakAfterWorkComplete,
		stopWorker,
		tErrors,
	]);

	const endSession = useCallback(
		async (options?: { endedBy?: "user" | "pause_cap" }) => {
			const endedBy = options?.endedBy ?? "user";
			setError(null);
			clearPauseCapTimer();
			const endingSessionId = _activeSessionId;
			const interruptedMidCycle =
				activeCycle != null &&
				cycleKind === "WORK" &&
				(state === "running" || state === "paused");
			const closureLine = buildSessionClosureLine(
				endedBy === "pause_cap" ? "pause_cap" : "user",
				{ interruptedMidCycle },
			);

			if (activeCycle != null && state === "running") {
				const cycleId = activeCycle.id;
				const isOptimisticCycle =
					mode === "authenticated" &&
					typeof cycleId === "number" &&
					cycleId < 0;

				stopWorker();
				endTimeRef.current = null;

				if (isOptimisticCycle) {
					cancelPendingStartRef.current = true;
				} else {
					try {
						await cycles.interrupt({ cycleId });
					} catch {
						// Best effort — continue ending session
					}
				}
			} else if (activeCycle != null && state === "paused") {
				const cycleId = activeCycle.id;
				const isOptimisticCycle =
					mode === "authenticated" &&
					typeof cycleId === "number" &&
					cycleId < 0;

				if (!isOptimisticCycle) {
					try {
						await cycles.interrupt({ cycleId });
					} catch {
						// Best effort — terminalize paused cycle without interrupt count
					}
				}
			}

			try {
				await sessions.end({
					closureLine,
					lastFocusedTaskId: focusedTaskId,
				});
			} catch {
				setError(tErrors("endSessionFailed"));
				return;
			}

			if (endingSessionId != null) {
				presentClosureOverlay(closureLine, endingSessionId);
			}

			setState("idle");
			setRemainingMs(0);
			setActiveCycle(null);
			setCycleKind(null);
			setFocusedTaskId(null);
			setFocusedTask(null);
			setPreFocusedTask(null);
			setHasActiveSession(false);
			setCompletedWorkCycles(0);
			setActiveSessionId(null);
			setSessionEnergyPending(false);
			setSessionIntention(null);
			setNarrativeTasksCompleted(0);
			setNarrativeLatestEnergy(null);
			setAwaitingWindDown(false);
			setWindDownDismissed(false);
			setWindDownRationale(null);
			pendingWindDownMarkTaskDoneRef.current = null;
			pendingWindDownWorkCycleIdRef.current = null;
			clearSuggestion();
			clearKickoffSuggestion();
			clearKickoffIdleFlags();
			clearBreakTransitionLine();

			await Promise.all([
				invalidateServerCycle(),
				utils.task.list.invalidate(),
			]);
		},
		[
			_activeSessionId,
			activeCycle,
			cycleKind,
			state,
			mode,
			cycles,
			sessions,
			stopWorker,
			buildSessionClosureLine,
			presentClosureOverlay,
			focusedTaskId,
			invalidateServerCycle,
			utils.task.list,
			clearSuggestion,
			clearKickoffSuggestion,
			clearKickoffIdleFlags,
			clearPauseCapTimer,
			clearBreakTransitionLine,
			tErrors,
		],
	);

	useEffect(() => {
		endSessionRef.current = endSession;
	}, [endSession]);

	const dismissSessionClosure = useCallback(() => {
		setPendingClosureLine(null);
	}, []);

	const onWindDownKeepGoing = useCallback(async () => {
		const markTaskDone = pendingWindDownMarkTaskDoneRef.current;
		const workCycleId = pendingWindDownWorkCycleIdRef.current;

		if (workCycleId == null) {
			return;
		}

		setIsConfirming(true);
		setError(null);

		try {
			setWindDownDismissed(true);
			setAwaitingWindDown(false);
			setWindDownRationale(null);
			pendingWindDownMarkTaskDoneRef.current = null;
			pendingWindDownWorkCycleIdRef.current = null;
			await continueAfterCheckIn(markTaskDone ?? false, workCycleId, {
				checkInAlreadySaved: true,
			});
		} finally {
			setIsConfirming(false);
		}
	}, [continueAfterCheckIn]);

	const onWindDownEndSession = useCallback(async () => {
		const markTaskDone = pendingWindDownMarkTaskDoneRef.current ?? false;

		setIsConfirming(true);
		setError(null);

		try {
			setAwaitingWindDown(false);
			setWindDownRationale(null);
			pendingWindDownMarkTaskDoneRef.current = null;
			pendingWindDownWorkCycleIdRef.current = null;
			const completed = await completeWorkCycleOnly(markTaskDone);
			if (!completed) {
				return;
			}
			await endSession();
		} finally {
			setIsConfirming(false);
		}
	}, [completeWorkCycleOnly, endSession]);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const dismissPendingWedgeRecovery = useCallback(() => {
		pendingWedgeIntentRef.current = null;
		setPendingWedgeRecovery(null);
		setError(null);
	}, []);

	const dismissCatchUp = useCallback(() => {
		setCatchUp(null);
		stopCycleEndTabPulse();
		tabWasHiddenWhileRunningRef.current = false;
	}, []);

	const isBreakRunning =
		state === "running" &&
		(cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK");

	const cyclePaused = state === "paused";

	const showSuggestionBeat =
		!cyclePaused && isBreakRunning && pendingSuggestion.status !== "idle";

	const inFlowSummaryLine = useMemo(() => {
		if (!hasActiveSession || state !== "idle") {
			return null;
		}
		if (awaitingCheckIn || awaitingWindDown || isPostCheckInTransitioning) {
			return null;
		}
		if (midCyclePendingTask != null) {
			return null;
		}
		if (showSuggestionBeat) {
			return null;
		}
		if (pendingSuggestion.status === "loading") {
			return null;
		}

		return buildInFlowSummary({
			cyclesCompleted: completedWorkCycles,
			tasksCompleted: narrativeTasksCompleted,
			latestEnergy: narrativeLatestEnergy,
			intention: sessionIntention,
		});
	}, [
		hasActiveSession,
		state,
		awaitingCheckIn,
		awaitingWindDown,
		isPostCheckInTransitioning,
		midCyclePendingTask,
		showSuggestionBeat,
		pendingSuggestion.status,
		completedWorkCycles,
		narrativeTasksCompleted,
		narrativeLatestEnergy,
		sessionIntention,
	]);

	return {
		state,
		remainingMs,
		focusedTask,
		focusedTaskId,
		activeCycle,
		cycleKind,
		hasActiveSession,
		error,
		pendingWedgeRecovery,
		midCyclePendingTask,
		isMidCycleSubmitting,
		awaitingCheckIn,
		isPostCheckInTransitioning,
		awaitingWindDown,
		windDownRationale,
		isConfirming,
		isWedgeSyncRetrying,
		pendingSuggestion,
		suggestionCycleId,
		suggestedTaskId,
		preFocusedTask,
		hasPreFocusedSuggestion,
		hasPreFocusedKickoff,
		stagedKickoffDurationSec,
		isAcceptingKickoffSuggestion,
		overrideAcknowledgement,
		breakTransitionLine,
		clearBreakTransitionLine,
		narrativeLatestEnergy,
		inFlowSummaryLine,
		pendingClosureLine,
		dismissSessionClosure,
		continueTaskId,
		completedWorkCycles,
		showSessionEnergy: sessionEnergyPending && kickoffEligible,
		sessionEnergyPending,
		sessionSteeringSubmitting,
		completeSessionEnergy,
		skipSessionEnergy,
		pendingKickoffSuggestion,
		kickoffSuggestedTaskId,
		kickoffEligible,
		catchUp,
		dismissCatchUp,
		selectTask,
		clearTask,
		acceptSuggestion,
		acceptKickoffSuggestion,
		selectKickoffDuration,
		clearStagedKickoffDuration,
		clearSuggestion,
		clearKickoffSuggestion,
		dismissPreFocus,
		retryKickoffSuggestion: () => {
			const wedgePhase = pendingWedgeIntentRef.current?.phase;
			if (
				wedgePhase === "kickoff_suggestion" ||
				wedgePhase === "kickoff_session"
			) {
				void retryWedgeSync();
				return;
			}
			if (_activeSessionId != null) {
				fetchKickoffSuggestion(
					Number(_activeSessionId),
					lastKickoffEnergyRef.current,
					lastSessionIntentionRef.current,
				);
			}
		},
		retrySuggestion: () => {
			if (pendingWedgeIntentRef.current?.phase === "suggestion_fetch") {
				void retryWedgeSync();
				return;
			}
			if (suggestionCycleId != null) {
				fetchSuggestion(suggestionCycleId);
			}
		},
		retryWedgeSync,
		start,
		interrupt,
		pause,
		resume,
		confirmComplete,
		onCycleCompleteConfirm,
		submitCheckIn,
		onWindDownKeepGoing,
		onWindDownEndSession,
		onMidCycleMarkComplete,
		onMidCycleContinueWithTask,
		onMidCycleEndCycleAndBreak,
		endSession,
		clearError,
		dismissPendingWedgeRecovery,
	};
}
