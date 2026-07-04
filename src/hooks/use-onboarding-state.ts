"use client";

import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { subscribeGuestStore } from "~/lib/guest/store";
import {
	shouldDeferFirstRun,
	subscribeDeferState,
} from "~/lib/onboarding/defer";
import { completeAuthenticatedWedgeCoach } from "~/lib/onboarding/post-merge-wedge-coach";
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
	scope: OnboardingScope;
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
	const stableScope = useMemo(
		(): OnboardingScope =>
			isGuest
				? { mode: "guest" }
				: { mode: "authenticated", userId: userId ?? "" },
		[isGuest, userId],
	);
	const scopeRef = useRef(stableScope);
	scopeRef.current = stableScope;

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
		setState((current) =>
			patchOnboardingState(
				scopeRef.current,
				completeAuthenticatedWedgeCoach(current),
			),
		);
	}, []);

	// Pessimistic true on first render (SSR + hydration) avoids overlay flash/mismatch.
	const [deferFirstRun, setDeferFirstRun] = useState(true);

	useLayoutEffect(() => {
		const syncDeferFirstRun = () => {
			setDeferFirstRun(shouldDeferFirstRun());
		};

		syncDeferFirstRun();
		const unsubscribeGuest = subscribeGuestStore(syncDeferFirstRun);
		const unsubscribeDefer = subscribeDeferState(syncDeferFirstRun);

		return () => {
			unsubscribeGuest();
			unsubscribeDefer();
		};
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
		scope: stableScope,
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
