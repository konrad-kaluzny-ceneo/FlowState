import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getCheckInCoachLine,
	getPostMergeCheckInCoachLine,
	getPostMergeSuggestionCoachLine,
	getSuggestionCoachLine,
} from "~/lib/onboarding/copy";
import type { OnboardingState } from "~/lib/onboarding/types";

export function isPostMergeWedgeCoachActive(state: OnboardingState): boolean {
	return (
		state.authenticatedWedgeCoachEligible && !state.hasSeenAuthenticatedWedge
	);
}

export function resolveCheckInCoachLine(
	state: OnboardingState,
	shouldShow: boolean,
	locale: UserLocale = "en",
): string | undefined {
	if (!shouldShow) {
		return undefined;
	}
	if (isPostMergeWedgeCoachActive(state)) {
		return getPostMergeCheckInCoachLine(locale);
	}
	return getCheckInCoachLine(locale);
}

export function resolveSuggestionCoachLine(
	state: OnboardingState,
	shouldShow: boolean,
	personaPresetLabel: string | null,
	locale: UserLocale = "en",
): string | undefined {
	if (!shouldShow) {
		return undefined;
	}
	if (isPostMergeWedgeCoachActive(state)) {
		return getPostMergeSuggestionCoachLine(personaPresetLabel, locale);
	}
	return getSuggestionCoachLine(locale);
}

export function completeAuthenticatedWedgeCoach(
	state: OnboardingState,
): Partial<OnboardingState> {
	if (!isPostMergeWedgeCoachActive(state)) {
		return { suggestionCoachSeen: true };
	}
	return {
		suggestionCoachSeen: true,
		hasSeenAuthenticatedWedge: true,
		authenticatedWedgeCoachEligible: false,
	};
}
