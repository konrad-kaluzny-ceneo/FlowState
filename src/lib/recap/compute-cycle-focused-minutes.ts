export type CycleMinutesInput = {
	kind: string;
	state: string;
	startedAt: Date;
	endedAt: Date | null;
	configuredDurationSec: number;
};

/**
 * Shared clamp + floor elapsed-time helper.
 * Returns elapsed minutes clamped to configuredDurationSec with a 1-minute floor,
 * or 0 if the cycle has no endedAt.
 */
function computeElapsedMinutes(cycle: CycleMinutesInput): number {
	if (cycle.endedAt == null) {
		return 0;
	}

	const elapsedSec = Math.min(
		cycle.configuredDurationSec,
		Math.max(
			0,
			Math.floor((cycle.endedAt.getTime() - cycle.startedAt.getTime()) / 1000),
		),
	);

	return Math.max(1, Math.ceil(elapsedSec / 60));
}

/**
 * Returns elapsed focus minutes for a WORK cycle that ended (COMPLETED or INTERRUPTED).
 * Non-WORK cycles and un-ended cycles return 0.
 */
export function computeCycleFocusedMinutes(cycle: CycleMinutesInput): number {
	if (cycle.kind !== "WORK") {
		return 0;
	}
	if (cycle.state !== "COMPLETED" && cycle.state !== "INTERRUPTED") {
		return 0;
	}

	return computeElapsedMinutes(cycle);
}

/**
 * Returns elapsed break minutes for a SHORT_BREAK/LONG_BREAK cycle that ended
 * (COMPLETED or INTERRUPTED). WORK cycles and un-ended cycles return 0.
 */
export function computeCycleBreakMinutes(cycle: CycleMinutesInput): number {
	if (cycle.kind !== "SHORT_BREAK" && cycle.kind !== "LONG_BREAK") {
		return 0;
	}
	if (cycle.state !== "COMPLETED" && cycle.state !== "INTERRUPTED") {
		return 0;
	}

	return computeElapsedMinutes(cycle);
}
