import {
	formatLocalDateKey,
	formatLocalDateKeyInTimeZone,
} from "~/lib/time/local-date-key";

export type CrossDaySessionState =
	| "ACTIVE"
	| "ENDED_BY_USER"
	| "ENDED_BY_TIMEOUT"
	| "ENDED_BY_CROSS_DAY";

export function isCrossDayStaleSession(
	session: { state: CrossDaySessionState | string; lastActivityAt: Date },
	localDateKey: string,
	options?: { timeZone?: string },
): boolean {
	if (session.state !== "ACTIVE") {
		return false;
	}

	const lastActivityKey =
		options?.timeZone != null
			? formatLocalDateKeyInTimeZone(session.lastActivityAt, options.timeZone)
			: formatLocalDateKey(session.lastActivityAt);

	return lastActivityKey !== localDateKey;
}
