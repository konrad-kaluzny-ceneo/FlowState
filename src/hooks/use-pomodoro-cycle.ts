"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createAudioManager } from "~/lib/audio";
import type { RouterOutputs } from "~/trpc/react";
import { api } from "~/trpc/react";
import type { TimerWorkerInbound, TimerWorkerOutbound } from "~/workers/timer-worker-logic";

export const POMODORO_ALARM_URL = "/sounds/pomodoro-complete.mp3";

type ActiveCycle = RouterOutputs["cycle"]["getActive"];
type FocusedTask = NonNullable<ActiveCycle>["task"];

export type PomodoroCycleState = "idle" | "running" | "completed";

export function usePomodoroCycle() {
	const [state, setState] = useState<PomodoroCycleState>("idle");
	const [remainingMs, setRemainingMs] = useState(0);
	const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
	const [focusedTask, setFocusedTask] = useState<FocusedTask>(null);
	const [activeCycle, setActiveCycle] = useState<ActiveCycle>(null);

	const endTimeRef = useRef<number | null>(null);
	const workerRef = useRef<Worker | null>(null);
	const audioRef = useRef(createAudioManager());
	const recoveredRef = useRef(false);

	const utils = api.useUtils();

	const { data: activeCycleQuery } = api.cycle.getActive.useQuery(undefined, {
		staleTime: 30_000,
	});

	const getOrCreateSession = api.session.getOrCreateActive.useMutation();
	const createCycle = api.cycle.create.useMutation();
	const completeCycle = api.cycle.complete.useMutation();
	const interruptCycle = api.cycle.interrupt.useMutation();

	const stopWorker = useCallback(() => {
		workerRef.current?.postMessage({ type: "stop" } satisfies TimerWorkerInbound);
	}, []);

	const startWorker = useCallback(
		(endTime: number) => {
			endTimeRef.current = endTime;
			setRemainingMs(Math.max(0, endTime - Date.now()));

			if (workerRef.current == null && typeof Worker !== "undefined") {
				workerRef.current = new Worker(
					new URL("../workers/timer-worker.ts", import.meta.url),
					{ type: "module" },
				);
				workerRef.current.onmessage = (
					event: MessageEvent<TimerWorkerOutbound>,
				) => {
					const message = event.data;
					if (message.type === "tick") {
						setRemainingMs(message.remaining);
						return;
					}
					if (message.type === "complete") {
						endTimeRef.current = null;
						setRemainingMs(0);
						setState("completed");
						void audioRef.current.playAlarm();
					}
				};
			}

			workerRef.current?.postMessage({
				type: "start",
				endTime,
			} satisfies TimerWorkerInbound);
		},
		[],
	);

	const handleCycleExpired = useCallback(() => {
		stopWorker();
		endTimeRef.current = null;
		setRemainingMs(0);
		setState("completed");
		void audioRef.current.playAlarm();
	}, [stopWorker]);

	const recalculateFromEndTime = useCallback(() => {
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
			setFocusedTask(cycle.task);
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
			if (focusedTaskId == null) {
				throw new Error("Select a task before starting a cycle");
			}

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

			setActiveCycle({ ...cycle, task: focusedTask });
			setState("running");
			startWorker(endTime);

			await utils.cycle.getActive.invalidate();
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

		stopWorker();
		endTimeRef.current = null;

		await interruptCycle.mutateAsync({ cycleId: activeCycle.id });

		setState("idle");
		setRemainingMs(0);
		setActiveCycle(null);

		await utils.cycle.getActive.invalidate();
	}, [activeCycle, interruptCycle, stopWorker, utils.cycle.getActive]);

	const confirmComplete = useCallback(
		async (markTaskDone: boolean) => {
			if (activeCycle == null) {
				return;
			}

			await completeCycle.mutateAsync({
				cycleId: activeCycle.id,
				markTaskDone,
			});

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
		[activeCycle, completeCycle, stopWorker, utils.cycle.getActive, utils.task.list],
	);

	return {
		state,
		remainingMs,
		focusedTask,
		focusedTaskId,
		activeCycle,
		selectTask,
		clearTask,
		start,
		interrupt,
		confirmComplete,
	};
}
