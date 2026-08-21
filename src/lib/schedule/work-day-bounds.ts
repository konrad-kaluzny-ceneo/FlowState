import { AXIS_END_MINUTE, AXIS_START_MINUTE, SNAP_MINUTES } from "./types";

/** Default work window when the user has not set one for the day. */
export const DEFAULT_WORK_START_MINUTE = 540; // 09:00
export const DEFAULT_WORK_END_MINUTE = 1020; // 17:00

export type WorkDayBounds = {
	workStartMinute: number;
	workEndMinute: number;
};

export function resolveWorkDayBounds(
	workStartMinute: number | null | undefined,
	workEndMinute: number | null | undefined,
): WorkDayBounds {
	return {
		workStartMinute: workStartMinute ?? DEFAULT_WORK_START_MINUTE,
		workEndMinute: workEndMinute ?? DEFAULT_WORK_END_MINUTE,
	};
}

export function isValidWorkDayBounds(
	workStartMinute: number,
	workEndMinute: number,
): boolean {
	return (
		workStartMinute >= AXIS_START_MINUTE &&
		workEndMinute <= AXIS_END_MINUTE &&
		workStartMinute % SNAP_MINUTES === 0 &&
		workEndMinute % SNAP_MINUTES === 0 &&
		workEndMinute - workStartMinute >= SNAP_MINUTES
	);
}
