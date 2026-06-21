/** Calm break-start and break→work re-entry lines (S-21, FR-014). */

import type { EnergyLevel } from "~/lib/domain/energy-level";

export const BREAK_START_SHORT = "A brief pause — let your mind reset.";

export const BREAK_START_LONG =
	"A longer rest — step away if you can, then return when ready.";

export const BREAK_REENTRY_FOCUSED =
	"Ready when you are — your focus is still here.";

export const BREAK_REENTRY_STEADY = "Ease back in — one cycle at a time.";

export const BREAK_REENTRY_FADING = "Whenever you're ready — no rush.";

export const BREAK_REENTRY_NEUTRAL =
	"Break complete — ready for the next cycle.";

export const BREAK_TRANSITION_VISIBLE_MS = 5_000;

export type BreakKind = "SHORT_BREAK" | "LONG_BREAK";

export function getBreakStartLine(breakKind: BreakKind): string {
	return breakKind === "LONG_BREAK" ? BREAK_START_LONG : BREAK_START_SHORT;
}

export function getBreakReentryLine(energy: EnergyLevel | null): string {
	if (energy === "FOCUSED") {
		return BREAK_REENTRY_FOCUSED;
	}
	if (energy === "STEADY") {
		return BREAK_REENTRY_STEADY;
	}
	if (energy === "FADING") {
		return BREAK_REENTRY_FADING;
	}
	return BREAK_REENTRY_NEUTRAL;
}
