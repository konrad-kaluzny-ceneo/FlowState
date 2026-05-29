import {
	getTimerTickResult,
	type TimerWorkerInbound,
	type TimerWorkerOutbound,
} from "~/workers/timer-worker-logic";

let intervalId: ReturnType<typeof setInterval> | null = null;
let activeEndTime: number | null = null;

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

	const result = getTimerTickResult(activeEndTime, Date.now());
	if (result.type === "complete") {
		stopTimer();
		postOutbound(result);
		return;
	}

	postOutbound(result);
}

function startTimer(endTime: number): void {
	stopTimer();
	activeEndTime = endTime;
	tick();
	if (activeEndTime === endTime) {
		intervalId = setInterval(tick, 1000);
	}
}

self.onmessage = (event: MessageEvent<TimerWorkerInbound>) => {
	const message = event.data;
	if (message.type === "start") {
		startTimer(message.endTime);
		return;
	}
	if (message.type === "stop") {
		stopTimer();
	}
};
