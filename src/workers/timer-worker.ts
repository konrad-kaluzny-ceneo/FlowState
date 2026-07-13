import {
	getTimerTickResult,
	MAX_OVERTIME_MS,
	type TimerWorkerInbound,
	type TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

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

	// Safety ceiling: after 2h of overtime, stop ticking to spare battery on
	// zombie tabs. This does NOT complete the break (the main thread keeps the
	// frozen running/overtime state); the session inactivity timeout is the
	// real backstop. Post the final elapsed so the display freezes accurately.
	if (result.type === "overtime" && result.elapsed >= MAX_OVERTIME_MS) {
		stopTimer();
		postOutbound(result);
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
