import { formatLocalDateKey } from "~/lib/time/local-date-key";

export type LocalDayBoundary = {
	start: Date;
	end: Date;
	localDateKey: string;
};

/**
 * Computes the UTC instants marking the start and end of the local calendar
 * day containing `date`. Uses local Date-component construction (not a raw
 * +24h offset) so the boundary is correct across DST transitions.
 */
export function getLocalDayBoundary(date: Date = new Date()): LocalDayBoundary {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
	return { start, end, localDateKey: formatLocalDateKey(date) };
}

/**
 * Computes `windowDays` consecutive local-day boundaries ending on
 * `referenceDate`'s local day (inclusive), oldest first. For client/guest use
 * only — has real local-calendar access, unlike the server (see recap.ts's
 * `getTrendStats`, which derives boundaries arithmetically from a single
 * client-supplied UTC instant instead).
 */
export function getLocalDayBoundaries(
	windowDays: number,
	referenceDate: Date = new Date(),
): LocalDayBoundary[] {
	const boundaries: LocalDayBoundary[] = [];
	for (let i = windowDays - 1; i >= 0; i--) {
		const day = new Date(
			referenceDate.getFullYear(),
			referenceDate.getMonth(),
			referenceDate.getDate() - i,
		);
		boundaries.push(getLocalDayBoundary(day));
	}
	return boundaries;
}
