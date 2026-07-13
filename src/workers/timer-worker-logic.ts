/**
 * Safety ceiling for break overtime: after 2 hours, stop ticking to avoid
 * burning battery/memory on zombie tabs. This does NOT complete the break —
 * the running/overtime state persists (frozen), and the server-side session
 * inactivity timeout remains the true completion backstop.
 */
export const MAX_OVERTIME_MS = 2 * 60 * 60 * 1000;

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
