import { onboardingKeyForScope } from "~/lib/onboarding/keys";
import {
	DEFAULT_ONBOARDING_STATE,
	type OnboardingScope,
	type OnboardingState,
} from "~/lib/onboarding/types";

const STORAGE_VERSION = 1;

type StoredOnboardingState = Partial<OnboardingState> & { v?: number };

function parseStoredState(raw: string | null): OnboardingState {
	if (raw == null) {
		return { ...DEFAULT_ONBOARDING_STATE };
	}

	try {
		const parsed = JSON.parse(raw) as StoredOnboardingState;
		return {
			firstRunDismissed: parsed.firstRunDismissed === true,
			checkInCoachSeen: parsed.checkInCoachSeen === true,
			suggestionCoachSeen: parsed.suggestionCoachSeen === true,
			presetCoachDismissed: parsed.presetCoachDismissed === true,
		};
	} catch {
		return { ...DEFAULT_ONBOARDING_STATE };
	}
}

export function loadOnboardingState(scope: OnboardingScope): OnboardingState {
	if (typeof window === "undefined") {
		return { ...DEFAULT_ONBOARDING_STATE };
	}

	const key = onboardingKeyForScope(scope);
	if (key == null) {
		return { ...DEFAULT_ONBOARDING_STATE };
	}

	try {
		return parseStoredState(localStorage.getItem(key));
	} catch {
		return { ...DEFAULT_ONBOARDING_STATE };
	}
}

export function saveOnboardingState(
	scope: OnboardingScope,
	state: OnboardingState,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = onboardingKeyForScope(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(
			key,
			JSON.stringify({
				v: STORAGE_VERSION,
				...state,
			}),
		);
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}

export function patchOnboardingState(
	scope: OnboardingScope,
	partial: Partial<OnboardingState>,
): OnboardingState {
	const current = loadOnboardingState(scope);
	const next: OnboardingState = { ...current, ...partial };
	saveOnboardingState(scope, next);
	return next;
}
