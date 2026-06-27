import type { OnboardingScope } from "~/lib/onboarding/types";

import {
	DEFAULT_USER_LOCALE,
	type UserLocale,
	userLocaleSchema,
} from "./types";

const KEY_GUEST = "flowstate:language:guest";

function keyForScope(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return KEY_GUEST;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:language:${scope.userId}`;
}

function isValidLocale(value: unknown): value is UserLocale {
	return (
		typeof value === "string" &&
		(userLocaleSchema as readonly string[]).includes(value)
	);
}

function parseStoredLocale(raw: string): UserLocale | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isValidLocale(parsed)) {
			return parsed;
		}
	} catch {
		if (isValidLocale(raw)) {
			return raw;
		}
	}

	return null;
}

export function readGuestLanguagePreference(): UserLocale | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const raw = localStorage.getItem(KEY_GUEST);
		if (raw == null) {
			return null;
		}

		return parseStoredLocale(raw);
	} catch {
		return null;
	}
}

export function readLanguagePreference(
	scope: OnboardingScope,
): UserLocale | null {
	if (typeof window === "undefined") {
		return null;
	}

	const key = keyForScope(scope);
	if (key == null) {
		return null;
	}

	try {
		const raw = localStorage.getItem(key);
		if (raw == null) {
			return null;
		}

		return parseStoredLocale(raw);
	} catch {
		return null;
	}
}

export function writeLanguagePreference(
	scope: OnboardingScope,
	locale: UserLocale,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = keyForScope(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(locale));
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}

/** Guest key only — for one-time auth handoff when server row is still unset. */
export function readGuestLanguageForMerge(): UserLocale | null {
	const locale = readGuestLanguagePreference();
	if (locale == null || locale === DEFAULT_USER_LOCALE) {
		return null;
	}

	return locale;
}
