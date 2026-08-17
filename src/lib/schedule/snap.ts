import { AXIS_END_MINUTE, AXIS_START_MINUTE, SNAP_MINUTES } from "./types";

export function snapMinute(value: number): number {
	const snapped = Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
	return Math.min(AXIS_END_MINUTE, Math.max(AXIS_START_MINUTE, snapped));
}
