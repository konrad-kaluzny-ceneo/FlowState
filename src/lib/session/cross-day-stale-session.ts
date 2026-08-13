import { formatLocalDateKey } from "~/lib/time/local-date-key";

export function isCrossDayStaleSession(
	session: { state: string; lastActivityAt: Date },
	localDateKey: string,
): boolean {
	return (
		session.state === "ACTIVE" &&
		formatLocalDateKey(session.lastActivityAt) !== localDateKey
	);
}
