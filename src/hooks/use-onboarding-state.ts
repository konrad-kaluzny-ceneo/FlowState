"use client";

import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { shouldDeferFirstRun } from "~/lib/onboarding/defer";
import {
	loadOnboardingState,
	patchOnboardingState,
} from "~/lib/onboarding/storage";
import {
	DEFAULT_ONBOARDING_STATE,
	type OnboardingScope,
	type OnboardingState,
} from "~/lib/onboarding/types";

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
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	// SSR-safe: defaults on server; hydrate from localStorage on client mount.
	const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);

	useEffect(() => {
		if (!isGuest && !userId) {
			return;
		}
		const nextScope: OnboardingScope = isGuest
			? { mode: "guest" }
			: { mode: "authenticated", userId: userId ?? "" };
		setState(loadOnboardingState(nextScope));
	}, [isGuest, userId]);

	const dismissFirstRun = useCallback(() => {
		setState(() =>
			patchOnboardingState(scopeRef.current, { firstRunDismissed: true }),
		);
	}, []);

	const markCheckInCoachSeen = useCallback(() => {
		setState(() =>
			patchOnboardingState(scopeRef.current, { checkInCoachSeen: true }),
		);
	}, []);

	const markSuggestionCoachSeen = useCallback(() => {
		setState(() =>
			patchOnboardingState(scopeRef.current, { suggestionCoachSeen: true }),
		);
	}, []);

	const [deferFirstRun, setDeferFirstRun] = useState(() =>
		shouldDeferFirstRun(),
	);

	useEffect(() => {
		setDeferFirstRun(shouldDeferFirstRun());
		const id = window.setInterval(() => {
			setDeferFirstRun(shouldDeferFirstRun());
		}, 200);
		return () => window.clearInterval(id);
	}, []);

	const isFirstRunVisible = useMemo(() => {
		if (!isGuest && !userId) {
			return false;
		}
		return !state.firstRunDismissed && !deferFirstRun;
	}, [isGuest, userId, state.firstRunDismissed, deferFirstRun]);

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
