export function formatFocusMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours > 0 && mins > 0) {
		return `${hours}h ${mins}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${mins}m`;
}
