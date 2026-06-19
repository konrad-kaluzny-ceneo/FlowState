import type { OnboardingScope } from "~/lib/onboarding/types";

const KEY_GUEST_ENABLED = "flowstate:outOfTabBreakAlerts:guest";
const KEY_GUEST_PROMPT_DISMISSED =
	"flowstate:outOfTabBreakAlertsPromptDismissed:guest";

function keyForEnabled(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return KEY_GUEST_ENABLED;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:outOfTabBreakAlerts:${scope.userId}`;
}

function keyForPromptDismissed(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return KEY_GUEST_PROMPT_DISMISSED;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:outOfTabBreakAlertsPromptDismissed:${scope.userId}`;
}

function parseBoolean(raw: string | null, defaultValue: boolean): boolean {
	if (raw == null) {
		return defaultValue;
	}

	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === "boolean") {
			return parsed;
		}
	} catch {
		if (raw === "true") return true;
		if (raw === "false") return false;
	}

	return defaultValue;
}

export function readOutOfTabBreakAlertsEnabled(
	scope: OnboardingScope,
): boolean {
	if (typeof window === "undefined") {
		return true;
	}

	const key = keyForEnabled(scope);
	if (key == null) {
		return true;
	}

	try {
		return parseBoolean(localStorage.getItem(key), true);
	} catch {
		return true;
	}
}

export function writeOutOfTabBreakAlertsEnabled(
	scope: OnboardingScope,
	enabled: boolean,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = keyForEnabled(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(enabled));
	} catch {
		// localStorage unavailable
	}
}

export function readNotificationPromptDismissed(
	scope: OnboardingScope,
): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	const key = keyForPromptDismissed(scope);
	if (key == null) {
		return false;
	}

	try {
		return parseBoolean(localStorage.getItem(key), false);
	} catch {
		return false;
	}
}

export function writeNotificationPromptDismissed(
	scope: OnboardingScope,
	dismissed: boolean,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = keyForPromptDismissed(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(dismissed));
	} catch {
		// localStorage unavailable
	}
}
