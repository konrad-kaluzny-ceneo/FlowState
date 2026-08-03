export function formatLocalDateKey(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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
