export type BreakAtmosphereInput = {
	cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	state: "idle" | "running" | "paused" | "completed";
	wedgeGateActive: boolean;
};

export function shouldShowBreakAtmosphere({
	cycleKind,
	state,
	wedgeGateActive,
}: BreakAtmosphereInput): boolean {
	if (wedgeGateActive) {
		return false;
	}
	const isBreakKind = cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
	if (!isBreakKind) {
		return false;
	}
	return state === "running" || state === "paused";
}

export const HOME_SHELL_MAIN_ID = "home-shell-main";
