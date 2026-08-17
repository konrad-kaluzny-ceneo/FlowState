import type { MinuteInterval } from "./types";

/** Half-open [start, start + duration): adjacent blocks do not overlap. */
export function intervalsOverlap(
	a: MinuteInterval,
	b: MinuteInterval,
): boolean {
	const aEnd = a.startMinute + a.durationMinutes;
	const bEnd = b.startMinute + b.durationMinutes;
	return a.startMinute < bEnd && b.startMinute < aEnd;
}
