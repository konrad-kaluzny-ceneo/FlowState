export interface OnboardingState {
	firstRunDismissed: boolean;
	checkInCoachSeen: boolean;
	suggestionCoachSeen: boolean;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
	firstRunDismissed: false,
	checkInCoachSeen: false,
	suggestionCoachSeen: false,
};

export type OnboardingScope =
	| { mode: "guest" }
	| { mode: "authenticated"; userId: string };
