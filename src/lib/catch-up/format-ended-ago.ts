export function formatEndedAgo(
	endedAtMs: number,
	nowMs: number = Date.now(),
): string {
	const elapsedSec = Math.max(0, Math.floor((nowMs - endedAtMs) / 1000));

	if (elapsedSec < 10) {
		return "just now";
	}

	if (elapsedSec < 60) {
		return `${elapsedSec} seconds ago`;
	}

	const elapsedMin = Math.floor(elapsedSec / 60);
	if (elapsedMin < 60) {
		return elapsedMin === 1 ? "1 minute ago" : `${elapsedMin} minutes ago`;
	}

	const elapsedHr = Math.floor(elapsedMin / 60);
	return elapsedHr === 1 ? "1 hour ago" : `${elapsedHr} hours ago`;
}
