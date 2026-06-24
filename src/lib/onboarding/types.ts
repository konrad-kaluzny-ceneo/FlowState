export interface OnboardingState {
	firstRunDismissed: boolean;
	checkInCoachSeen: boolean;
	suggestionCoachSeen: boolean;
	presetCoachDismissed: boolean;
	authenticatedWedgeCoachEligible: boolean;
	hasSeenAuthenticatedWedge: boolean;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
	firstRunDismissed: false,
	checkInCoachSeen: false,
	suggestionCoachSeen: false,
	presetCoachDismissed: false,
	authenticatedWedgeCoachEligible: false,
	hasSeenAuthenticatedWedge: false,
};

export type OnboardingScope =
	| { mode: "guest" }
	| { mode: "authenticated"; userId: string };
