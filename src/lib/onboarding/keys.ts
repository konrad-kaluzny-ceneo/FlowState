import type { OnboardingScope } from "~/lib/onboarding/types";

export const ONBOARDING_KEY_GUEST = "flowstate:onboarding:guest";

export function onboardingKeyForScope(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return ONBOARDING_KEY_GUEST;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:onboarding:${scope.userId}`;
}
