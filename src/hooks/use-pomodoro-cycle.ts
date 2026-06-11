"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioManager } from "~/lib/audio";
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
	DomainActiveCycle,
	DomainTaskId,
	FocusedTask,
} from "~/lib/data-mode/types";

type CreatedActiveCycle = Omit<DomainActiveCycle, "task"> & {
	task?: DomainActiveCycle["task"];
};

import {
	getLongBreakDuration,
	getShortBreakDuration,
	setLastDuration,
} from "~/lib/duration-storage";
import type { OnboardingScope } from "~/lib/onboarding/types";
import type { RationaleBreakdown } from "~/lib/scoring/rationale-breakdown";
import {
	buildWindDownRationale,
	shouldShowWindDownNudge,
} from "~/lib/session/wind-down-nudge";
import {
	OVERRIDE_ACK_LINE,
	OVERRIDE_ACK_VISIBLE_MS,
} from "~/lib/suggestion/override-ack-copy";
import { beginSuggestionFetch } from "~/lib/trpc/suggestion-priority";
import { setWorkTypeDuration } from "~/lib/work-type-duration-storage";
import { api } from "~/trpc/react";
import type {
	TimerWorkerInbound,
	TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

export const POMODORO_ALARM_URL = "/sounds/pomodoro-complete.mp3";

/** E2E uses Playwright fake timers; server `startedAt` must not drive break expiry. */
const useE2eClientTimer = process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER === "1";

function cycleEndTimeMs(cycle: {
	startedAt: Date;
	configuredDurationSec: number;
}): number {
	if (useE2eClientTimer) {
		return Date.now() + cycle.configuredDurationSec * 1000;
	}
	return cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
}

export type { FocusedTask };

export type PomodoroCycleState = "idle" | "running" | "completed";

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
};

export function usePomodoroCycle(options?: UsePomodoroCycleOptions) {
	const getCycleEndAudioModeRef = useRef<() => CycleEndAudioMode>(
		options?.getCycleEndAudioMode ?? (() => "normal"),
	);

	useEffect(() => {
		getCycleEndAudioModeRef.current =
			options?.getCycleEndAudioMode ?? (() => "normal");
	}, [options?.getCycleEndAudioMode]);

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
	const [isAcceptingSuggestion, setIsAcceptingSuggestion] = useState(false);
	const [isAcceptingKickoffSuggestion, setIsAcceptingKickoffSuggestion] =
		useState(false);
	const [overrideAcknowledgement, setOverrideAcknowledgement] = useState<
		string | null
	>(null);
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
	const [awaitingKickoffReadiness, setAwaitingKickoffReadiness] =
		useState(false);
	const [kickoffReadinessSubmitting, setKickoffReadinessSubmitting] =
		useState(false);

	const createCheckIn = api.checkIn.create.useMutation();
	const suggestionNextPostCheckIn = api.suggestion.next.useMutation();
	const suggestionNextKickoff = api.suggestion.next.useMutation();
	const recordDecisionMutation = api.suggestion.recordDecision.useMutation();

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
	const tabWasHiddenWhileRunningRef = useRef(false);
	const cancelPendingStartRef = useRef(false);
	const pendingCreateRef = useRef<Promise<CreatedActiveCycle> | null>(null);
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

	const resolveServerCycleId = useCallback(async (): Promise<number> => {
		const current = activeCycleRef.current;
		if (current == null) {
			throw new Error("No active cycle");
		}

		const { id } = current;
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
			throw new Error("Invalid cycle id from pending create");
		}

		throw new Error("Optimistic cycle without pending create");
	}, []);

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
			const endTime = cycleEndTimeMs(cycle);
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
			startWorker(endTime);
		},
		[setCatchUpFromExpiry, startWorker],
	);

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
			setSessionStartIdleFlag(true);
		}
	}, [
		cycles,
		resumeFromActiveCycle,
		mode,
		utils.client.cycle.countCompletedWork,
	]);

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

		void queryTasks()
			.then((tasks) => {
				setHasActiveTasks(tasks.some((task) => task.status === "active"));
			})
			.catch(() => {
				setHasActiveTasks(false);
			});
	}, [mode, utils]);

	useEffect(() => {
		loadActiveTasks();
	}, [loadActiveTasks]);

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
		setOverrideAcknowledgement(OVERRIDE_ACK_LINE);
		overrideAckTimerRef.current = setTimeout(() => {
			setOverrideAcknowledgement(null);
			overrideAckTimerRef.current = null;
		}, OVERRIDE_ACK_VISIBLE_MS);
	}, [clearOverrideAck]);

	const clearKickoffSuggestion = useCallback(() => {
		kickoffFetchGenRef.current += 1;
		setPendingKickoffSuggestion({ status: "idle" });
		setKickoffSuggestedTaskId(null);
		setHasPreFocusedKickoff(false);
		setStagedKickoffDurationSec(null);
		setAwaitingKickoffReadiness(false);
		setKickoffReadinessSubmitting(false);
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
				setError(
					"Could not save suggestion preference. Your choice is kept locally.",
				);
			}
		},
		[suggestionCycleId, recordDecisionMutation],
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
				setError(
					"Could not save suggestion preference. Your choice is kept locally.",
				);
			}
		},
		[_activeSessionId, recordDecisionMutation],
	);

	const fetchPostCheckInSuggestion = useCallback(
		async (cycleId: number, gen: number) => {
			const result = await suggestionNextPostCheckIn.mutateAsync({
				context: "post_check_in",
				cycleId,
				localHour: new Date().getHours(),
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
		(sessionId: number, energy: "FOCUSED" | "STEADY" | "FADING") => {
			const gen = ++kickoffFetchGenRef.current;
			lastKickoffEnergyRef.current = energy;
			setPendingKickoffSuggestion({ status: "loading" });
			setKickoffSuggestedTaskId(null);

			void (async () => {
				const endSuggestionFetch = beginSuggestionFetch();
				try {
					const result = await suggestionNextKickoff.mutateAsync({
						context: "kickoff",
						sessionId,
						localHour: new Date().getHours(),
						energy,
					});
					if (gen !== kickoffFetchGenRef.current) {
						return;
					}
					if (result == null) {
						setPendingKickoffSuggestion({ status: "empty" });
						setKickoffSuggestedTaskId(null);
					} else if (!("cycleId" in result)) {
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
				} catch {
					if (gen !== kickoffFetchGenRef.current) {
						return;
					}
					setPendingKickoffSuggestion({ status: "error" });
					setKickoffSuggestedTaskId(null);
				} finally {
					endSuggestionFetch();
					setKickoffReadinessSubmitting(false);
				}
			})();
		},
		[suggestionNextKickoff],
	);

	const submitKickoffReadiness = useCallback(
		(energy: "FOCUSED" | "STEADY" | "FADING") => {
			if (_activeSessionId == null) {
				return;
			}
			setKickoffReadinessSubmitting(true);
			setAwaitingKickoffReadiness(false);
			fetchKickoffSuggestion(Number(_activeSessionId), energy);
		},
		[_activeSessionId, fetchKickoffSuggestion],
	);

	const skipKickoffReadiness = useCallback(() => {
		submitKickoffReadiness("STEADY");
	}, [submitKickoffReadiness]);

	const kickoffEligible =
		mode === "authenticated" &&
		state === "idle" &&
		cycleKind === null &&
		focusedTaskId === null &&
		!awaitingCheckIn &&
		!awaitingWindDown &&
		!isPostCheckInTransitioning &&
		pendingSuggestion.status === "idle" &&
		hasActiveTasks &&
		(sessionStartIdleFlag || postBreakIdleFlag);

	useEffect(() => {
		const wasEligible = prevKickoffEligibleRef.current;
		prevKickoffEligibleRef.current = kickoffEligible;

		if (!kickoffEligible) {
			if (wasEligible && awaitingKickoffReadiness) {
				setAwaitingKickoffReadiness(false);
			}
			return;
		}

		if (wasEligible || awaitingKickoffReadiness) {
			return;
		}

		if (pendingKickoffSuggestion.status !== "idle") {
			return;
		}

		void (async () => {
			try {
				const session = await sessions.getOrCreateActive();
				setActiveSessionId(session.id);
				setAwaitingKickoffReadiness(true);
			} catch {
				setPendingKickoffSuggestion({ status: "error" });
			}
		})();
	}, [
		kickoffEligible,
		sessions,
		awaitingKickoffReadiness,
		pendingKickoffSuggestion.status,
	]);

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

	const acceptSuggestion = useCallback(async () => {
		if (pendingSuggestion.status !== "ready") {
			return;
		}

		const { data } = pendingSuggestion;
		setIsAcceptingSuggestion(true);
		setError(null);

		try {
			preFocusTask(data.taskId, {
				id: data.taskId,
				title: data.title,
			});
			setHasPreFocusedSuggestion(true);
			await recordSuggestionDecision(data.taskId, data.taskId);
		} finally {
			setIsAcceptingSuggestion(false);
		}
	}, [pendingSuggestion, preFocusTask, recordSuggestionDecision]);

	const acceptKickoffSuggestion = useCallback(async () => {
		if (pendingKickoffSuggestion.status !== "ready") {
			return;
		}

		const { data } = pendingKickoffSuggestion;
		setIsAcceptingKickoffSuggestion(true);
		setError(null);

		try {
			preFocusTask(data.taskId, {
				id: data.taskId,
				title: data.title,
			});
			setHasPreFocusedKickoff(true);
			clearKickoffIdleFlags();
			await recordKickoffDecision(data.taskId, data.taskId);
		} finally {
			setIsAcceptingKickoffSuggestion(false);
		}
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

	// NFR 200ms: authenticated start/interrupt update UI before server settles (B-03).
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
				setError(
					"Finish or dismiss the current cycle before starting another.",
				);
				return;
			}

			if (focusedTaskId == null) {
				setError("Select a task before starting a cycle.");
				return;
			}

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
					setCompletedWorkCycles(0);
				}

				setActiveSessionId(session.id);
				setHasActiveSession(true);

				const createCall = cycles.create({
					kind: "WORK",
					configuredDurationSec: effectiveDurationSec,
					taskId: focusedTaskId,
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
				setError(
					"Could not start the cycle. Check your connection and try again.",
				);
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
		],
	);

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
			setError("Could not interrupt the cycle. Try again.");
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

			await Promise.all([
				invalidateServerCycle(),
				...(markTaskDone ? [utils.task.list.invalidate()] : []),
			]);
		},
		[
			completedWorkCycles,
			cycles,
			invalidateServerCycle,
			startWorker,
			utils.task.list,
		],
	);

	const completeWorkCycleOnly = useCallback(
		async (markTaskDone: boolean): Promise<boolean> => {
			if (activeCycle == null) {
				return false;
			}

			setError(null);

			let cycleId: number;
			try {
				cycleId = await resolveServerCycleId();
			} catch {
				setError(
					"Could not save cycle completion. Check your connection and try again.",
				);
				return false;
			}

			try {
				await retryOnce(() =>
					cycles.complete({
						cycleId,
						markTaskDone,
						...(pendingIncrementInterruptionRef.current
							? { incrementInterruption: true }
							: {}),
					}),
				);
			} catch {
				setError(
					"Could not save cycle completion. Check your connection and try again.",
				);
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
				...(markTaskDone ? [utils.task.list.invalidate()] : []),
			]);

			return true;
		},
		[
			activeCycle,
			cycles,
			invalidateServerCycle,
			resolveServerCycleId,
			stopWorker,
			utils.task.list,
		],
	);

	const confirmComplete = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			setError(null);

			const currentKind = activeCycle.kind;

			let cycleId: number;
			try {
				cycleId = await resolveServerCycleId();
			} catch {
				setError(
					"Could not save cycle completion. Check your connection and try again.",
				);
				return;
			}

			try {
				await retryOnce(() =>
					cycles.complete({
						cycleId,
						markTaskDone,
						...(pendingIncrementInterruptionRef.current
							? { incrementInterruption: true }
							: {}),
					}),
				);
			} catch {
				setError(
					"Could not save cycle completion. Check your connection and try again.",
				);
				return;
			}

			pendingIncrementInterruptionRef.current = false;

			stopWorker();
			endTimeRef.current = null;

			if (currentKind === "WORK") {
				try {
					await startBreakAfterWorkComplete(markTaskDone);
				} catch {
					setError("Break could not start. Your work cycle was saved.");
					setState("idle");
					setRemainingMs(0);
					setActiveCycle(null);
					setCycleKind(null);
					setFocusedTaskId(null);
					setFocusedTask(null);
				}
			} else {
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
			resolveServerCycleId,
			startBreakAfterWorkComplete,
			stopWorker,
			utils.task.list,
			preFocusedTask,
			clearSuggestion,
		],
	);

	const continueAfterCheckIn = useCallback(
		async (markTaskDone: boolean, workCycleId: number) => {
			setIsPostCheckInTransitioning(true);
			clearKickoffSuggestion();
			clearKickoffIdleFlags();
			const gen = ++suggestionFetchGenRef.current;
			suggestionCycleIdRef.current = workCycleId;
			setPendingSuggestion({ status: "loading" });
			setSuggestionCycleId(workCycleId);
			setSuggestedTaskId(null);
			setHasPreFocusedSuggestion(false);

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
		},
		[
			confirmComplete,
			fetchPostCheckInSuggestion,
			clearKickoffSuggestion,
			clearKickoffIdleFlags,
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
		async (nextTaskId: DomainTaskId, nextTask: FocusedTask) => {
			if (midCyclePendingTask == null || activeCycle == null) {
				return;
			}

			setIsMidCycleSubmitting(true);
			setError(null);

			try {
				const cycleId = await resolveServerCycleId();
				await tasks.update({
					id: midCyclePendingTask.id,
					status: "completed",
				});
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
				setError("Could not switch tasks. Try again.");
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
			resolveServerCycleId,
			utils.task.list,
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

			setIsConfirming(true);
			setError(null);

			const markTaskDone = pendingMarkTaskDone;

			let workCycleId: number;
			try {
				workCycleId = await resolveServerCycleId();
			} catch {
				setError("Could not save check-in. Try again.");
				setIsConfirming(false);
				return;
			}

			try {
				await createCheckIn.mutateAsync({
					cycleId: workCycleId,
					energy,
				});
			} catch {
				setError("Could not save check-in. Try again.");
				setIsConfirming(false);
				return;
			}

			try {
				if (mode !== "guest") {
					try {
						const session = await sessions.getOrCreateActive();

						if (
							shouldShowWindDownNudge({
								energy,
								completedWorkCycles,
								interruptionCount: session.interruptionCount,
								dismissed: windDownDismissed,
							})
						) {
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
							return;
						}
					} catch {
						// Wind-down is optional; never block check-in → break transition.
					}
				}

				await continueAfterCheckIn(markTaskDone, workCycleId);
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
		],
	);

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
				const cycleId = await resolveServerCycleId();
				await retryOnce(() =>
					cycles.complete({
						cycleId,
						markTaskDone: true,
					}),
				);
				await startBreakAfterWorkComplete(true);
			} catch {
				setError("Break could not start. Your work cycle was saved.");
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
		resolveServerCycleId,
		startBreakAfterWorkComplete,
		stopWorker,
	]);

	const endSession = useCallback(async () => {
		setError(null);

		// If a cycle is running, interrupt it first
		if (activeCycle != null && state === "running") {
			const cycleId = activeCycle.id;
			const isOptimisticCycle =
				mode === "authenticated" && typeof cycleId === "number" && cycleId < 0;

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
		}

		try {
			await sessions.end();
		} catch {
			setError("Could not end the session. Try again.");
			return;
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
		setAwaitingWindDown(false);
		setWindDownDismissed(false);
		setWindDownRationale(null);
		pendingWindDownMarkTaskDoneRef.current = null;
		pendingWindDownWorkCycleIdRef.current = null;
		clearSuggestion();
		clearKickoffSuggestion();
		clearKickoffIdleFlags();

		await Promise.all([invalidateServerCycle(), utils.task.list.invalidate()]);
	}, [
		activeCycle,
		state,
		mode,
		cycles,
		sessions,
		stopWorker,
		invalidateServerCycle,
		utils.task.list,
		clearSuggestion,
		clearKickoffSuggestion,
		clearKickoffIdleFlags,
	]);

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
			await continueAfterCheckIn(markTaskDone ?? false, workCycleId);
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

	const dismissCatchUp = useCallback(() => {
		setCatchUp(null);
		stopCycleEndTabPulse();
		tabWasHiddenWhileRunningRef.current = false;
	}, []);

	return {
		state,
		remainingMs,
		focusedTask,
		focusedTaskId,
		activeCycle,
		cycleKind,
		hasActiveSession,
		error,
		midCyclePendingTask,
		isMidCycleSubmitting,
		awaitingCheckIn,
		isPostCheckInTransitioning,
		awaitingWindDown,
		windDownRationale,
		isConfirming,
		pendingSuggestion,
		suggestionCycleId,
		suggestedTaskId,
		preFocusedTask,
		hasPreFocusedSuggestion,
		hasPreFocusedKickoff,
		stagedKickoffDurationSec,
		isAcceptingSuggestion,
		isAcceptingKickoffSuggestion,
		overrideAcknowledgement,
		pendingKickoffSuggestion,
		kickoffSuggestedTaskId,
		kickoffEligible,
		awaitingKickoffReadiness,
		kickoffReadinessSubmitting,
		submitKickoffReadiness,
		skipKickoffReadiness,
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
			if (_activeSessionId != null) {
				fetchKickoffSuggestion(
					Number(_activeSessionId),
					lastKickoffEnergyRef.current,
				);
			}
		},
		retrySuggestion: () => {
			if (suggestionCycleId != null) {
				fetchSuggestion(suggestionCycleId);
			}
		},
		start,
		interrupt,
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
	};
}
