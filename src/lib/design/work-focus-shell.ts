export type WorkFocusShellInput = {
	cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	state: "idle" | "running" | "paused" | "completed";
	wedgeGateActive: boolean;
};

export function shouldShowWorkFocusShell({
	cycleKind,
	state,
	wedgeGateActive,
}: WorkFocusShellInput): boolean {
	if (wedgeGateActive) {
		return false;
	}
	if (cycleKind !== "WORK") {
		return false;
	}
	return state === "running" || state === "paused";
}
