export function formatRemainingMs(ms: number): string {
	if (ms < 0) {
		return formatOvertimeMs(-ms);
	}
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format overtime (elapsed past configured end) as `+MM:SS`.
 * Input is positive elapsed ms past end.
 */
export function formatOvertimeMs(elapsedMs: number): string {
	const totalSec = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	return `+${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
