export function formatLocalDateKey(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Formats a date as YYYY-MM-DD in the given IANA timezone (for server-side cross-day checks). */
export function formatLocalDateKeyInTimeZone(
	date: Date,
	timeZone: string,
): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export function getClientTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Subtracts whole calendar days from a YYYY-MM-DD key without a timezone. */
export function subtractLocalDateKey(
	localDateKey: string,
	days: number,
): string {
	const [year = 1970, month = 1, day = 1] = localDateKey.split("-").map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() - days);
	return date.toISOString().slice(0, 10);
}
