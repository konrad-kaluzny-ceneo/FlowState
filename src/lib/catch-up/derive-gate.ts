import type { CatchUpGate } from "./types";

export type CatchUpGateSnapshot = {
	state: "idle" | "running" | "paused" | "completed";
	cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	awaitingCheckIn: boolean;
	cyclePaused?: boolean;
};

export function deriveCatchUpGate(
	snapshot: CatchUpGateSnapshot,
): CatchUpGate | null {
	if (snapshot.cyclePaused || snapshot.state === "paused") {
		return null;
	}

	if (snapshot.awaitingCheckIn) {
		return "CHECK_IN";
	}

	if (snapshot.state === "completed") {
		if (snapshot.cycleKind === "WORK") {
			return "WORK_CONFIRM";
		}
		// Breaks no longer enter "completed" state — they run overtime until
		// the user explicitly accepts. BREAK_CONFIRM is retired.
	}

	return null;
}
