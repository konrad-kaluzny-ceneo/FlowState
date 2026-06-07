"use client";

import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { shouldDeferFirstRun } from "~/lib/onboarding/defer";
import {
	loadOnboardingState,
	patchOnboardingState,
} from "~/lib/onboarding/storage";
import type { OnboardingScope, OnboardingState } from "~/lib/onboarding/types";

type OnboardingContextValue = {
	state: OnboardingState;
	dismissFirstRun: () => void;
	markCheckInCoachSeen: () => void;
	markSuggestionCoachSeen: () => void;
	isFirstRunVisible: boolean;
	shouldShowCheckInCoach: boolean;
	shouldShowSuggestionCoach: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function useOnboardingState(scope: OnboardingScope): OnboardingContextValue {
	const isGuest = scope.mode === "guest";
	const userId = isGuest ? null : scope.userId;

	const [state, setState] = useState<OnboardingState>(() =>
		loadOnboardingState(scope),
	);

	useEffect(() => {
		const nextScope: OnboardingScope = isGuest
			? { mode: "guest" }
			: { mode: "authenticated", userId: userId ?? "" };
		setState(loadOnboardingState(nextScope));
	}, [isGuest, userId]);

	const dismissFirstRun = useCallback(() => {
		setState(() => patchOnboardingState(scope, { firstRunDismissed: true }));
	}, [scope]);

	const markCheckInCoachSeen = useCallback(() => {
		setState(() => patchOnboardingState(scope, { checkInCoachSeen: true }));
	}, [scope]);

	const markSuggestionCoachSeen = useCallback(() => {
		setState(() => patchOnboardingState(scope, { suggestionCoachSeen: true }));
	}, [scope]);

	const isFirstRunVisible = useMemo(
		() => !state.firstRunDismissed && !shouldDeferFirstRun(),
		[state.firstRunDismissed],
	);

	const shouldShowCheckInCoach = !state.checkInCoachSeen;
	const shouldShowSuggestionCoach = !state.suggestionCoachSeen;

	return {
		state,
		dismissFirstRun,
		markCheckInCoachSeen,
		markSuggestionCoachSeen,
		isFirstRunVisible,
		shouldShowCheckInCoach,
		shouldShowSuggestionCoach,
	};
}

export function OnboardingProvider({
	scope,
	children,
}: {
	scope: OnboardingScope;
	children: ReactNode;
}) {
	const value = useOnboardingState(scope);

	return createElement(OnboardingContext.Provider, { value }, children);
}

export function useOnboarding(): OnboardingContextValue {
	const context = useContext(OnboardingContext);
	if (context == null) {
		throw new Error("useOnboarding must be used within OnboardingProvider");
	}

	return context;
}
