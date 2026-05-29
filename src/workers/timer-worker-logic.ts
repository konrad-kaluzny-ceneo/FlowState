export type TimerWorkerInbound =
	| { type: "start"; endTime: number }
	| { type: "stop" };

export type TimerWorkerOutbound =
	| { type: "tick"; remaining: number }
	| { type: "complete" };

export function getTimerTickResult(
	endTime: number,
	now: number,
): TimerWorkerOutbound {
	const remaining = endTime - now;
	if (remaining <= 0) {
		return { type: "complete" };
	}
	return { type: "tick", remaining };
}
