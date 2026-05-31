export const DEFAULT_DURATION_SEC = 25 * 60;
export const DEFAULT_SHORT_BREAK_SEC = 5 * 60;
export const DEFAULT_LONG_BREAK_SEC = 15 * 60;

const STORAGE_KEY = "flowstate:lastDurationSec";
const SHORT_BREAK_STORAGE_KEY = "flowstate:shortBreakDurationSec";
const LONG_BREAK_STORAGE_KEY = "flowstate:longBreakDurationSec";

const MIN_DURATION_SEC = 5 * 60;
const MAX_DURATION_SEC = 90 * 60;
const MIN_BREAK_DURATION_SEC = 1 * 60;
const MAX_BREAK_DURATION_SEC = 30 * 60;

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

export function getShortBreakDuration(): number {
	if (typeof window === "undefined") {
		return DEFAULT_SHORT_BREAK_SEC;
	}

	try {
		const raw = localStorage.getItem(SHORT_BREAK_STORAGE_KEY);
		if (raw == null) {
			return DEFAULT_SHORT_BREAK_SEC;
		}

		const parsed = Number.parseInt(raw, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < MIN_BREAK_DURATION_SEC ||
			parsed > MAX_BREAK_DURATION_SEC
		) {
			return DEFAULT_SHORT_BREAK_SEC;
		}

		return parsed;
	} catch {
		return DEFAULT_SHORT_BREAK_SEC;
	}
}

export function setShortBreakDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(
			MAX_BREAK_DURATION_SEC,
			Math.max(MIN_BREAK_DURATION_SEC, sec),
		);
		localStorage.setItem(SHORT_BREAK_STORAGE_KEY, String(clamped));
	} catch {
		// localStorage unavailable
	}
}

export function getLongBreakDuration(): number {
	if (typeof window === "undefined") {
		return DEFAULT_LONG_BREAK_SEC;
	}

	try {
		const raw = localStorage.getItem(LONG_BREAK_STORAGE_KEY);
		if (raw == null) {
			return DEFAULT_LONG_BREAK_SEC;
		}

		const parsed = Number.parseInt(raw, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < MIN_BREAK_DURATION_SEC ||
			parsed > MAX_BREAK_DURATION_SEC
		) {
			return DEFAULT_LONG_BREAK_SEC;
		}

		return parsed;
	} catch {
		return DEFAULT_LONG_BREAK_SEC;
	}
}

export function setLongBreakDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(
			MAX_BREAK_DURATION_SEC,
			Math.max(MIN_BREAK_DURATION_SEC, sec),
		);
		localStorage.setItem(LONG_BREAK_STORAGE_KEY, String(clamped));
	} catch {
		// localStorage unavailable
	}
}
