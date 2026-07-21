/**
 * Cycle expiry maths extracted from `use-pomodoro-cycle` (F-09).
 *
 * Pure apart from the ambient clock, which callers can override for tests.
 */

import type { DomainActiveCycle } from "~/lib/data-mode/types";

/** E2E uses Playwright fake timers; server `startedAt` must not drive break expiry. */
const useE2eClientTimer = process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER === "1";

export type CycleEndTimeInput = {
	startedAt: Date;
	configuredDurationSec: number;
	state?: DomainActiveCycle["state"];
	remainingDurationSec?: number | null;
};

export type CycleEndTimeOptions = {
	/** Defaults to `Date.now()`. */
	now?: number;
	/** Defaults to the `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` build flag. */
	clientTimer?: boolean;
};

/**
 * Wall-clock ms at which a cycle expires.
 *
 * A paused cycle restarts from its frozen remainder; under the E2E client
 * timer the duration is measured from "now" so Playwright's fake clock owns
 * expiry; otherwise expiry is anchored to the server-issued `startedAt`.
 */
export function cycleEndTimeMs(
	cycle: CycleEndTimeInput,
	options?: CycleEndTimeOptions,
): number {
	const now = options?.now ?? Date.now();
	const clientTimer = options?.clientTimer ?? useE2eClientTimer;

	if (cycle.state === "PAUSED" && cycle.remainingDurationSec != null) {
		return now + cycle.remainingDurationSec * 1000;
	}
	if (clientTimer) {
		return now + cycle.configuredDurationSec * 1000;
	}
	return cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
}

/** Frozen remainder of a paused cycle in ms, never negative. */
export function pausedRemainingMs(cycle: {
	remainingDurationSec?: number | null;
}): number {
	return Math.max(0, (cycle.remainingDurationSec ?? 0) * 1000);
}
