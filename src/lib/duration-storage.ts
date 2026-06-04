import {
	getMaxBreakDurationSec,
	getMaxWorkDurationSec,
	getMinBreakDurationSec,
	getMinWorkDurationSec,
	isE2eFastDurationsEnabled,
} from "~/lib/duration-bounds";

export const DEFAULT_DURATION_SEC = 25 * 60;
export const DEFAULT_SHORT_BREAK_SEC = 5 * 60;
export const DEFAULT_LONG_BREAK_SEC = 15 * 60;

const STORAGE_KEY = "flowstate:lastDurationSec";
const SHORT_BREAK_STORAGE_KEY = "flowstate:shortBreakDurationSec";
const LONG_BREAK_STORAGE_KEY = "flowstate:longBreakDurationSec";

export function getLastDuration(): number {
	const defaultSec = isE2eFastDurationsEnabled() ? 1 : DEFAULT_DURATION_SEC;

	if (typeof window === "undefined") {
		return defaultSec;
	}

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw == null) {
			return defaultSec;
		}

		const parsed = Number.parseInt(raw, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < getMinWorkDurationSec() ||
			parsed > getMaxWorkDurationSec()
		) {
			return defaultSec;
		}

		return parsed;
	} catch {
		return defaultSec;
	}
}

export function setLastDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(
			getMaxWorkDurationSec(),
			Math.max(getMinWorkDurationSec(), sec),
		);
		localStorage.setItem(STORAGE_KEY, String(clamped));
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}

export function getShortBreakDuration(): number {
	const defaultSec = isE2eFastDurationsEnabled() ? 1 : DEFAULT_SHORT_BREAK_SEC;

	if (typeof window === "undefined") {
		return defaultSec;
	}

	try {
		const raw = localStorage.getItem(SHORT_BREAK_STORAGE_KEY);
		if (raw == null) {
			return defaultSec;
		}

		const parsed = Number.parseInt(raw, 10);
		if (
			!Number.isFinite(parsed) ||
			parsed < getMinBreakDurationSec() ||
			parsed > getMaxBreakDurationSec()
		) {
			return isE2eFastDurationsEnabled() ? 1 : DEFAULT_SHORT_BREAK_SEC;
		}

		return parsed;
	} catch {
		return isE2eFastDurationsEnabled() ? 1 : DEFAULT_SHORT_BREAK_SEC;
	}
}

export function setShortBreakDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(
			getMaxBreakDurationSec(),
			Math.max(getMinBreakDurationSec(), sec),
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
			parsed < getMinBreakDurationSec() ||
			parsed > getMaxBreakDurationSec()
		) {
			return isE2eFastDurationsEnabled() ? 1 : DEFAULT_LONG_BREAK_SEC;
		}

		return parsed;
	} catch {
		return isE2eFastDurationsEnabled() ? 1 : DEFAULT_LONG_BREAK_SEC;
	}
}

export function setLongBreakDuration(sec: number): void {
	if (typeof window === "undefined") {
		return;
	}

	try {
		const clamped = Math.min(
			getMaxBreakDurationSec(),
			Math.max(getMinBreakDurationSec(), sec),
		);
		localStorage.setItem(LONG_BREAK_STORAGE_KEY, String(clamped));
	} catch {
		// localStorage unavailable
	}
}
