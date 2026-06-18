import type { CatchUpGate } from "./types";

export type CatchUpGateSnapshot = {
	state: "idle" | "running" | "paused" | "completed";
	cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	awaitingCheckIn: boolean;
	pendingSuggestionStatus: "idle" | "loading" | "ready" | "empty" | "error";
	cyclePaused?: boolean;
};

function isBreakKind(
	kind: CatchUpGateSnapshot["cycleKind"],
): kind is "SHORT_BREAK" | "LONG_BREAK" {
	return kind === "SHORT_BREAK" || kind === "LONG_BREAK";
}

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
		if (isBreakKind(snapshot.cycleKind)) {
			return "BREAK_CONFIRM";
		}
	}

	if (
		snapshot.state === "running" &&
		isBreakKind(snapshot.cycleKind) &&
		snapshot.pendingSuggestionStatus === "ready"
	) {
		return "SUGGESTION_ACCEPT";
	}

	return null;
}
