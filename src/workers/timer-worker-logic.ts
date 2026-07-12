export type TimerWorkerInbound =
	| { type: "start"; endTime: number; mode: "work" | "break" }
	| { type: "stop" };

export type TimerWorkerOutbound =
	| { type: "tick"; remaining: number }
	| { type: "complete" }
	| { type: "overtime"; elapsed: number };

export function getTimerTickResult(
	endTime: number,
	now: number,
	mode: "work" | "break",
): TimerWorkerOutbound {
	const remaining = endTime - now;
	if (remaining <= 0) {
		if (mode === "break") {
			return { type: "overtime", elapsed: now - endTime };
		}
		return { type: "complete" };
	}
	return { type: "tick", remaining };
}
