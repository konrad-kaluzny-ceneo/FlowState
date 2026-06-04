/** Work cycle length bounds (FR-010). Break bounds (FR-011). */

export const E2E_FAST_WORK_PRESET_SEC = 1;
export const E2E_FAST_WORK_PRESET_LABEL = "1 sec";

/** Server/guest API minimum (cycle router); UI custom picker uses 5 min unless E2E fast. */
const STANDARD_MIN_WORK_SEC = 60;
const STANDARD_MIN_CUSTOM_WORK_SEC = 5 * 60;
const STANDARD_MAX_WORK_SEC = 90 * 60;
const STANDARD_MIN_BREAK_SEC = 1 * 60;
const STANDARD_MAX_BREAK_SEC = 30 * 60;

export function isE2eFastDurationsEnabled(): boolean {
	return process.env.NEXT_PUBLIC_E2E_FAST_DURATIONS === "1";
}

export function getMinWorkDurationSec(): number {
	return isE2eFastDurationsEnabled() ? 1 : STANDARD_MIN_WORK_SEC;
}

export function getMaxWorkDurationSec(): number {
	return STANDARD_MAX_WORK_SEC;
}

/** Minimum for the custom minutes field in TimerPanel (stricter than API min). */
export function getMinCustomWorkDurationSec(): number {
	return isE2eFastDurationsEnabled() ? 1 : STANDARD_MIN_CUSTOM_WORK_SEC;
}

export function getMinBreakDurationSec(): number {
	return isE2eFastDurationsEnabled() ? 1 : STANDARD_MIN_BREAK_SEC;
}

export function getMaxBreakDurationSec(): number {
	return STANDARD_MAX_BREAK_SEC;
}

export function getWorkDurationPresets(): ReadonlyArray<{
	label: string;
	sec: number;
}> {
	const standard = [
		{ label: "15 min", sec: 15 * 60 },
		{ label: "25 min", sec: 25 * 60 },
		{ label: "45 min", sec: 45 * 60 },
		{ label: "60 min", sec: 60 * 60 },
	] as const;

	if (!isE2eFastDurationsEnabled()) {
		return standard;
	}

	return [
		{ label: E2E_FAST_WORK_PRESET_LABEL, sec: E2E_FAST_WORK_PRESET_SEC },
		...standard,
	];
}
