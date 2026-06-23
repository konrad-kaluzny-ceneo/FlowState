import {
	CHECK_IN_COACH_LINE,
	getPostMergeSuggestionCoachLine,
	POST_MERGE_CHECK_IN_COACH_LINE,
	SUGGESTION_COACH_LINE,
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
): string | undefined {
	if (!shouldShow) {
		return undefined;
	}
	if (isPostMergeWedgeCoachActive(state)) {
		return POST_MERGE_CHECK_IN_COACH_LINE;
	}
	return CHECK_IN_COACH_LINE;
}

export function resolveSuggestionCoachLine(
	state: OnboardingState,
	shouldShow: boolean,
	personaPresetLabel: string | null,
): string | undefined {
	if (!shouldShow) {
		return undefined;
	}
	if (isPostMergeWedgeCoachActive(state)) {
		return getPostMergeSuggestionCoachLine(personaPresetLabel);
	}
	return SUGGESTION_COACH_LINE;
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
