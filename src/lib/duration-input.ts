export function splitSecToMinSec(totalSec: number): {
	minutes: number;
	seconds: number;
} {
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	return { minutes, seconds };
}

export function combineMinSecToSec(minutes: number, seconds: number): number {
	return minutes * 60 + seconds;
}

export function isDurationSecInRange(
	totalSec: number,
	minSec: number,
	maxSec: number,
): boolean {
	return (
		Number.isFinite(totalSec) &&
		Number.isInteger(totalSec) &&
		totalSec >= minSec &&
		totalSec <= maxSec
	);
}

export function findMatchingPreset(
	totalSec: number,
	presets: ReadonlyArray<{ sec: number }>,
): { sec: number } | undefined {
	return presets.find((preset) => preset.sec === totalSec);
}
