import { AXIS_END_MINUTE, AXIS_START_MINUTE, SNAP_MINUTES } from "./types";

export function snapMinute(value: number): number {
	const snapped = Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
	return Math.min(AXIS_END_MINUTE, Math.max(AXIS_START_MINUTE, snapped));
}

/** Round up to the next 15-minute mark (never before `value`). */
export function ceilSnapMinute(value: number): number {
	const snapped =
		Math.ceil(value / SNAP_MINUTES) * SNAP_MINUTES || AXIS_START_MINUTE;
	return Math.min(AXIS_END_MINUTE, Math.max(AXIS_START_MINUTE, snapped));
}
