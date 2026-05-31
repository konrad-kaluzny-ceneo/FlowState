"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioManager } from "~/lib/audio";
import {
	useDataMode,
	useRepositories,
} from "~/lib/data-mode/data-mode-context";
import type {
	DomainActiveCycle,
	DomainTaskId,
	FocusedTask,
} from "~/lib/data-mode/types";
import {
	getLongBreakDuration,
	getShortBreakDuration,
	setLastDuration,
} from "~/lib/duration-storage";
import { api } from "~/trpc/react";
import type {
	TimerWorkerInbound,
	TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

export const POMODORO_ALARM_URL = "/sounds/pomodoro-complete.mp3";

export type { FocusedTask };

export type PomodoroCycleState = "idle" | "running" | "completed";

export type CycleKind = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

let activeCycleRecoveredForMode: string | null = null;

/** Test-only reset for module-level recovery guard. */
export function resetActiveCycleRecoveryForTests(): void {
	activeCycleRecoveredForMode = null;
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

export function usePomodoroCycle() {
	const mode = useDataMode();
	const { cycles, sessions, refreshGuest } = useRepositories();
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

	const stateRef = useRef(state);
	const endTimeRef = useRef<number | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const audioRef = useRef(createAudioManager());
	const recoveredRef = useRef(false);
	const useWorkerRef = useRef(
		process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER !== "1",
	);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const invalidateServerCycle = useCallback(async () => {
		if (mode === "authenticated") {
			await utils.cycle.getActive.invalidate();
		} else {
			refreshGuest();
		}
	}, [mode, refreshGuest, utils.cycle.getActive]);

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

	const handleCycleExpired = useCallback(() => {
		if (stateRef.current !== "running") {
			return;
		}
		stopWorker();
		endTimeRef.current = null;
		setRemainingMs(0);
		setState("completed");
		void audioRef.current.playAlarm().catch(() => {});
	}, [stopWorker]);

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
			const endTime =
				cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
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
				void audioRef.current.playAlarm().catch(() => {});
				return;
			}

			setState("running");
			startWorker(endTime);
		},
		[startWorker],
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
					const sessionCycles = await utils.client.cycle.list.query({
						sessionId: Number(active.sessionId),
					});
					const count = sessionCycles.filter(
						(c) => c.kind === "WORK" && c.state === "COMPLETED",
					).length;
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
		}
	}, [cycles, resumeFromActiveCycle, mode, utils.client.cycle.list]);

	useEffect(() => {
		// When mode changes (e.g. guest → authenticated on login), allow re-recovery
		recoveredRef.current = false;
	}, [mode]);

	useEffect(() => {
		void recoverActiveCycle();
	}, [recoverActiveCycle]);

	useEffect(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState !== "visible") {
				return;
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
		};
	}, [stopWorker]);

	const selectTask = useCallback(
		(taskId: DomainTaskId, task?: FocusedTask) => {
			if (state === "running" || state === "completed") {
				return;
			}
			setError(null);
			setFocusedTaskId(taskId);
			setFocusedTask(task ?? null);
		},
		[state],
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
			setError(null);

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

			try {
				try {
					await audioRef.current.unlock();
					await audioRef.current.preload(POMODORO_ALARM_URL);
				} catch {
					// Audio is best-effort; cycle start must not depend on it.
				}

				const session = await sessions.getOrCreateActive();
				setActiveSessionId(session.id);
				setHasActiveSession(true);

				const cycle = await cycles.create({
					kind: "WORK",
					configuredDurationSec: durationSec,
					taskId: focusedTaskId,
				});

				const endTime =
					cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;

				setActiveCycle({
					...cycle,
					task: focusedTask,
				});
				setCycleKind("WORK");
				setState("running");
				startWorker(endTime);
				setLastDuration(durationSec);

				await invalidateServerCycle();
			} catch {
				setError(
					"Could not start the cycle. Check your connection and try again.",
				);
			}
		},
		[
			state,
			focusedTaskId,
			focusedTask,
			sessions,
			cycles,
			startWorker,
			invalidateServerCycle,
		],
	);

	const interrupt = useCallback(async () => {
		if (activeCycle == null) {
			return;
		}

		setError(null);
		stopWorker();
		endTimeRef.current = null;

		try {
			await cycles.interrupt({ cycleId: activeCycle.id });

			setState("idle");
			setRemainingMs(0);
			setActiveCycle(null);
			setCycleKind(null);

			await invalidateServerCycle();
		} catch {
			setError("Could not interrupt the cycle. Try again.");
		}
	}, [activeCycle, cycles, invalidateServerCycle, stopWorker]);

	const confirmComplete = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			setError(null);

			const currentKind = activeCycle.kind;

			try {
				await retryOnce(() =>
					cycles.complete({
						cycleId: activeCycle.id,
						markTaskDone,
					}),
				);
			} catch {
				setError(
					"Could not save cycle completion. Check your connection and try again.",
				);
				return;
			}

			stopWorker();
			endTimeRef.current = null;

			if (currentKind === "WORK") {
				// Work cycle completed — auto-start a break
				const newCount = completedWorkCycles + 1;
				setCompletedWorkCycles(newCount);

				const breakKind: CycleKind =
					newCount % 4 === 0 ? "LONG_BREAK" : "SHORT_BREAK";
				const breakDuration =
					breakKind === "LONG_BREAK"
						? getLongBreakDuration()
						: getShortBreakDuration();

				try {
					const breakCycle = await cycles.create({
						kind: breakKind,
						configuredDurationSec: breakDuration,
					});

					const endTime =
						breakCycle.startedAt.getTime() +
						breakCycle.configuredDurationSec * 1000;

					setActiveCycle({ ...breakCycle, task: null });
					setCycleKind(breakKind);
					setState("running");
					startWorker(endTime);

					await invalidateServerCycle();
				} catch {
					// Break could not start — acceptable degradation
					setError("Break could not start. Your work cycle was saved.");
					setState("idle");
					setRemainingMs(0);
					setActiveCycle(null);
					setCycleKind(null);
					setFocusedTaskId(null);
					setFocusedTask(null);
				}
			} else {
				// Break cycle completed — return to idle
				setState("idle");
				setRemainingMs(0);
				setActiveCycle(null);
				setCycleKind(null);
				setFocusedTaskId(null);
				setFocusedTask(null);

				await Promise.all([
					invalidateServerCycle(),
					utils.task.list.invalidate(),
				]);
			}
		},
		[
			activeCycle,
			cycles,
			completedWorkCycles,
			invalidateServerCycle,
			stopWorker,
			startWorker,
			utils.task.list,
		],
	);

	const endSession = useCallback(async () => {
		setError(null);

		// If a cycle is running, interrupt it first
		if (activeCycle != null && state === "running") {
			stopWorker();
			endTimeRef.current = null;
			try {
				await cycles.interrupt({ cycleId: activeCycle.id });
			} catch {
				// Best effort — continue ending session
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
		setHasActiveSession(false);
		setCompletedWorkCycles(0);
		setActiveSessionId(null);

		await Promise.all([invalidateServerCycle(), utils.task.list.invalidate()]);
	}, [
		activeCycle,
		state,
		cycles,
		sessions,
		stopWorker,
		invalidateServerCycle,
		utils.task.list,
	]);

	const clearError = useCallback(() => {
		setError(null);
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
		selectTask,
		clearTask,
		start,
		interrupt,
		confirmComplete,
		endSession,
		clearError,
	};
}
