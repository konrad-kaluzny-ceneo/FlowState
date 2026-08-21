import type { DomainScheduleBlock, MinuteInterval } from "./types";
import { AXIS_END_MINUTE, AXIS_START_MINUTE, SNAP_MINUTES } from "./types";

/** Half-open [start, start + duration): adjacent blocks do not overlap. */
export function intervalsOverlap(
	a: MinuteInterval,
	b: MinuteInterval,
): boolean {
	const aEnd = a.startMinute + a.durationMinutes;
	const bEnd = b.startMinute + b.durationMinutes;
	return a.startMinute < bEnd && b.startMinute < aEnd;
}

export function wouldOverlap(
	candidate: MinuteInterval,
	blocks: readonly Pick<
		DomainScheduleBlock,
		"id" | "startMinute" | "durationMinutes"
	>[],
	excludeBlockId?: number,
): boolean {
	return blocks.some(
		(block) =>
			block.id !== excludeBlockId && intervalsOverlap(block, candidate),
	);
}

/**
 * Scan outward from preferredStart (15-min steps) for the nearest non-overlapping
 * slot. Returns null when the day has no room for durationMinutes.
 */
export function findNearestOpenSlot(
	blocks: readonly Pick<
		DomainScheduleBlock,
		"id" | "startMinute" | "durationMinutes"
	>[],
	durationMinutes: number,
	preferredStart: number,
	excludeBlockId?: number,
): number | null {
	const maxStart = AXIS_END_MINUTE - durationMinutes;
	if (maxStart < AXIS_START_MINUTE) {
		return null;
	}

	const snappedPreferred = Math.min(
		maxStart,
		Math.max(
			AXIS_START_MINUTE,
			Math.round(preferredStart / SNAP_MINUTES) * SNAP_MINUTES,
		),
	);

	const tryStart = (start: number): number | null => {
		if (start < AXIS_START_MINUTE || start > maxStart) {
			return null;
		}
		const candidate = { startMinute: start, durationMinutes };
		if (!wouldOverlap(candidate, blocks, excludeBlockId)) {
			return start;
		}
		return null;
	};

	const exact = tryStart(snappedPreferred);
	if (exact != null) {
		return exact;
	}

	for (
		let offset = SNAP_MINUTES;
		snappedPreferred - offset >= AXIS_START_MINUTE ||
		snappedPreferred + offset <= maxStart;
		offset += SNAP_MINUTES
	) {
		const earlier = tryStart(snappedPreferred - offset);
		if (earlier != null) {
			return earlier;
		}
		const later = tryStart(snappedPreferred + offset);
		if (later != null) {
			return later;
		}
	}

	return null;
}

/**
 * First open slot at or after preferredStart (falls back to axis start when
 * preferredStart is omitted).
 */
export function findOpenSlot(
	blocks: readonly Pick<
		DomainScheduleBlock,
		"id" | "startMinute" | "durationMinutes"
	>[],
	durationMinutes: number,
	preferredStart: number = AXIS_START_MINUTE,
): number | null {
	const maxStart = AXIS_END_MINUTE - durationMinutes;
	const startFrom = Math.min(
		maxStart,
		Math.max(
			AXIS_START_MINUTE,
			Math.round(preferredStart / SNAP_MINUTES) * SNAP_MINUTES,
		),
	);

	for (let start = startFrom; start <= maxStart; start += SNAP_MINUTES) {
		const candidate = { startMinute: start, durationMinutes };
		if (!wouldOverlap(candidate, blocks)) {
			return start;
		}
	}

	for (
		let start = AXIS_START_MINUTE;
		start < startFrom;
		start += SNAP_MINUTES
	) {
		const candidate = { startMinute: start, durationMinutes };
		if (!wouldOverlap(candidate, blocks)) {
			return start;
		}
	}

	return null;
}
