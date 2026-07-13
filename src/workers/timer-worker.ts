import {
	getTimerTickResult,
	type TimerWorkerInbound,
	type TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

/**
 * Safety ceiling: self-stop after 2 hours of overtime to avoid burning
 * battery/memory on zombie tabs where the main thread never sent "stop".
 */
const MAX_OVERTIME_MS = 2 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let activeEndTime: number | null = null;
let activeMode: "work" | "break" = "work";

function stopTimer(): void {
	if (intervalId != null) {
		clearInterval(intervalId);
		intervalId = null;
	}
	activeEndTime = null;
}

function postOutbound(message: TimerWorkerOutbound): void {
	self.postMessage(message);
}

function tick(): void {
	if (activeEndTime == null) {
		return;
	}

	const result = getTimerTickResult(activeEndTime, Date.now(), activeMode);
	if (result.type === "complete") {
		stopTimer();
		postOutbound(result);
		return;
	}

	// Safety ceiling: force-complete if overtime exceeds 2 hours
	if (result.type === "overtime" && result.elapsed >= MAX_OVERTIME_MS) {
		stopTimer();
		postOutbound({ type: "complete" });
		return;
	}

	// For overtime and tick, keep the interval alive
	postOutbound(result);
}

function startTimer(endTime: number, mode: "work" | "break"): void {
	stopTimer();
	activeEndTime = endTime;
	activeMode = mode;
	tick();
	if (activeEndTime === endTime) {
		intervalId = setInterval(tick, 1000);
	}
}

self.onmessage = (event: MessageEvent<TimerWorkerInbound>) => {
	const message = event.data;
	if (message.type === "start") {
		startTimer(message.endTime, message.mode);
		return;
	}
	if (message.type === "stop") {
		stopTimer();
	}
};
