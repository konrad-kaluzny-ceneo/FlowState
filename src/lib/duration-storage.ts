export const DEFAULT_DURATION_SEC = 25 * 60;
const STORAGE_KEY = "flowstate:lastDurationSec";
const MIN_DURATION_SEC = 5 * 60;
const MAX_DURATION_SEC = 90 * 60;

export function getLastDuration(): number {
	if (typeof window === "undefined") {
		return DEFAULT_DURATION_SEC;
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw == null) {
			return DEFAULT_DURATION_SEC;
		}

		const parsed = Number.parseInt(raw, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < MIN_DURATION_SEC ||
			parsed > MAX_DURATION_SEC
		) {
			return DEFAULT_DURATION_SEC;
		}

		return parsed;
	} catch {
		return DEFAULT_DURATION_SEC;
	}
}

export function setLastDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, sec));
		localStorage.setItem(STORAGE_KEY, String(clamped));
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}
