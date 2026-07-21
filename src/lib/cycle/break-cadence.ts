/**
 * Break cadence rules extracted from `use-pomodoro-cycle` (F-09).
 *
 * Pure: no state, no effects, no storage access.
 */

import type { BreakCycleKind, CycleKind } from "~/lib/domain/cycle-kind";

/** Every 4th break in a row is a long one. */
export const LONG_BREAK_CADENCE = 4;

/**
 * Which break the next transition should suggest, given how many short breaks
 * have been taken since the last long one. The `+ 1` counts the break that is
 * about to start.
 */
export function resolveBreakCadenceSuggestion(
	cyclesSinceLastLong: number,
): BreakCycleKind {
	return cyclesSinceLastLong + 1 >= LONG_BREAK_CADENCE
		? "LONG_BREAK"
		: "SHORT_BREAK";
}

/** True when the cycle kind is a break (short or long) rather than work. */
export function isBreakKind(kind: CycleKind | null): boolean {
	return kind === "SHORT_BREAK" || kind === "LONG_BREAK";
}
