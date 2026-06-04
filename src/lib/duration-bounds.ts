/** Work cycle length bounds (FR-010). Break bounds (FR-011). */

export const MIN_WORK_DURATION_SEC = 1;
export const MAX_WORK_DURATION_SEC = 90 * 60;
export const MIN_BREAK_DURATION_SEC = 1 * 60;
export const MAX_BREAK_DURATION_SEC = 30 * 60;

export function getMinWorkDurationSec(): number {
	return MIN_WORK_DURATION_SEC;
}

export function getMaxWorkDurationSec(): number {
	return MAX_WORK_DURATION_SEC;
}

/** Minimum for the custom seconds field in TimerPanel (same as API min). */
export function getMinCustomWorkDurationSec(): number {
	return getMinWorkDurationSec();
}

export function getMinBreakDurationSec(): number {
	return MIN_BREAK_DURATION_SEC;
}

export function getMaxBreakDurationSec(): number {
	return MAX_BREAK_DURATION_SEC;
}

export function getWorkDurationPresets(): ReadonlyArray<{
	label: string;
	sec: number;
}> {
	return [
		{ label: "15 min", sec: 15 * 60 },
		{ label: "25 min", sec: 25 * 60 },
		{ label: "45 min", sec: 45 * 60 },
		{ label: "60 min", sec: 60 * 60 },
	] as const;
}
