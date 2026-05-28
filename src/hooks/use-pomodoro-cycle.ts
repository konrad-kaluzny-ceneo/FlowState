"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createAudioManager } from "~/lib/audio";
import { setLastDuration } from "~/lib/duration-storage";
import type { RouterOutputs } from "~/trpc/react";
import { api } from "~/trpc/react";
import type {
	TimerWorkerInbound,
	TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

export const POMODORO_ALARM_URL = "/sounds/pomodoro-complete.mp3";

type ActiveCycle = RouterOutputs["cycle"]["getActive"];

export type FocusedTask = { id: number; title: string } | null;

export type PomodoroCycleState = "idle" | "running" | "completed";

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
	const [state, setState] = useState<PomodoroCycleState>("idle");
	const [remainingMs, setRemainingMs] = useState(0);
	const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
	const [focusedTask, setFocusedTask] = useState<FocusedTask>(null);
	const [activeCycle, setActiveCycle] = useState<ActiveCycle>(null);
	const [error, setError] = useState<string | null>(null);

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

	const utils = api.useUtils();

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const { data: activeCycleQuery } = api.cycle.getActive.useQuery(undefined, {
		staleTime: 30_000,
	});

	const getOrCreateSession = api.session.getOrCreateActive.useMutation();
	const createCycle = api.cycle.create.useMutation();
	const completeCycle = api.cycle.complete.useMutation();
	const interruptCycle = api.cycle.interrupt.useMutation();

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
		void audioRef.current.playAlarm();
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
		(cycle: NonNullable<ActiveCycle>) => {
			const endTime =
				cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
			setActiveCycle(cycle);
			setFocusedTask(
				cycle.task != null
					? { id: cycle.task.id, title: cycle.task.title }
					: null,
			);
			setFocusedTaskId(cycle.taskId);

			if (endTime <= Date.now()) {
				setState("completed");
				void audioRef.current.playAlarm();
				return;
			}

			setState("running");
			startWorker(endTime);
		},
		[startWorker],
	);

	useEffect(() => {
		if (recoveredRef.current || activeCycleQuery === undefined) {
			return;
		}

		recoveredRef.current = true;

		if (activeCycleQuery) {
			resumeFromActiveCycle(activeCycleQuery);
		}
	}, [activeCycleQuery, resumeFromActiveCycle]);

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
		(taskId: number, task?: FocusedTask) => {
			if (state === "running") {
				return;
			}
			setError(null);
			setFocusedTaskId(taskId);
			setFocusedTask(task ?? null);
		},
		[state],
	);

	const clearTask = useCallback(() => {
		if (state === "running") {
			return;
		}
		setFocusedTaskId(null);
		setFocusedTask(null);
	}, [state]);

	const start = useCallback(
		async (durationSec: number) => {
			setError(null);

			if (focusedTaskId == null) {
				setError("Select a task before starting a cycle.");
				return;
			}

			try {
				await audioRef.current.unlock();
				await audioRef.current.preload(POMODORO_ALARM_URL);

				await getOrCreateSession.mutateAsync();

				const cycle = await createCycle.mutateAsync({
					kind: "WORK",
					configuredDurationSec: durationSec,
					taskId: focusedTaskId,
				});

				const endTime =
					cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;

				setActiveCycle({
					...cycle,
					task: focusedTask,
				} as NonNullable<ActiveCycle>);
				setState("running");
				startWorker(endTime);
				setLastDuration(durationSec);

				await utils.cycle.getActive.invalidate();
			} catch {
				setError(
					"Could not start the cycle. Check your connection and try again.",
				);
			}
		},
		[
			focusedTaskId,
			focusedTask,
			getOrCreateSession,
			createCycle,
			startWorker,
			utils.cycle.getActive,
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
			await interruptCycle.mutateAsync({ cycleId: activeCycle.id });

			setState("idle");
			setRemainingMs(0);
			setActiveCycle(null);

			await utils.cycle.getActive.invalidate();
		} catch {
			setError("Could not interrupt the cycle. Try again.");
		}
	}, [activeCycle, interruptCycle, stopWorker, utils.cycle.getActive]);

	const confirmComplete = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			setError(null);

			try {
				await retryOnce(() =>
					completeCycle.mutateAsync({
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
			setState("idle");
			setRemainingMs(0);
			setActiveCycle(null);
			setFocusedTaskId(null);
			setFocusedTask(null);

			await Promise.all([
				utils.cycle.getActive.invalidate(),
				utils.task.list.invalidate(),
			]);
		},
		[
			activeCycle,
			completeCycle,
			stopWorker,
			utils.cycle.getActive,
			utils.task.list,
		],
	);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	return {
		state,
		remainingMs,
		focusedTask,
		focusedTaskId,
		activeCycle,
		error,
		selectTask,
		clearTask,
		start,
		interrupt,
		confirmComplete,
		clearError,
	};
}
