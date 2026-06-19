import type { WorkType } from "~/lib/domain/work-type";

/** Work cycle length bounds (FR-010). Break bounds (FR-011). */

export const MIN_WORK_DURATION_SEC = 1;
export const MAX_WORK_DURATION_SEC = 90 * 60;
export const MIN_BREAK_DURATION_SEC = 1;
export const MAX_BREAK_DURATION_SEC = 30 * 60;

export function getMinWorkDurationSec(): number {
	return MIN_WORK_DURATION_SEC;
}

export function getMaxWorkDurationSec(): number {
	return MAX_WORK_DURATION_SEC;
}

/** Minimum valid work duration (same as API min). */
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

export function getShortBreakPresets(): ReadonlyArray<{
	label: string;
	sec: number;
}> {
	return [
		{ label: "3 min", sec: 3 * 60 },
		{ label: "5 min", sec: 5 * 60 },
		{ label: "10 min", sec: 10 * 60 },
	] as const;
}

export function getLongBreakPresets(): ReadonlyArray<{
	label: string;
	sec: number;
}> {
	return [
		{ label: "10 min", sec: 10 * 60 },
		{ label: "15 min", sec: 15 * 60 },
		{ label: "20 min", sec: 20 * 60 },
	] as const;
}

/** PRD-aligned kickoff chip defaults per work type (S-15). */
export const KICKOFF_PRESET_SEC: Record<WorkType, number> = {
	DEEP_WORK: 45 * 60,
	OPERATIONAL: 25 * 60,
	REACTIVE: 15 * 60,
};

export function getKickoffPresetSec(workType: WorkType): number {
	return KICKOFF_PRESET_SEC[workType];
}
