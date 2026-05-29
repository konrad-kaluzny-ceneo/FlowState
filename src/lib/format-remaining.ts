export function formatRemainingMs(ms: number): string {
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
