export interface OnboardingState {
	firstRunDismissed: boolean;
	checkInCoachSeen: boolean;
	suggestionCoachSeen: boolean;
	presetCoachDismissed: boolean;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
	firstRunDismissed: false,
	checkInCoachSeen: false,
	suggestionCoachSeen: false,
	presetCoachDismissed: false,
};

export type OnboardingScope =
	| { mode: "guest" }
	| { mode: "authenticated"; userId: string };
