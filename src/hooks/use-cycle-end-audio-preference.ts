"use client";

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import {
	readCycleEndAudioMode,
	readGuestModeForMerge,
	writeCycleEndAudioMode,
} from "~/lib/cycle-audio-preference/storage";
import {
	type CycleEndAudioMode,
	DEFAULT_CYCLE_END_AUDIO_MODE,
} from "~/lib/cycle-audio-preference/types";
import type { OnboardingScope } from "~/lib/onboarding/types";
import {
	getSuggestionFetchInFlight,
	subscribeSuggestionFetchInFlight,
	waitUntilSuggestionIdle,
} from "~/lib/trpc/suggestion-priority";
import { api } from "~/trpc/react";

export function useCycleEndAudioPreference(scope: OnboardingScope) {
	const isGuest = scope.mode === "guest";
	const userId = isGuest ? null : scope.userId;
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	const [mode, setModeState] = useState<CycleEndAudioMode>(() =>
		readCycleEndAudioMode(scope),
	);
	const [isHydrated, setIsHydrated] = useState(isGuest);
	const [mountSettled, setMountSettled] = useState(isGuest);
	const guestMergeAttemptedRef = useRef(false);
	const guestMergeGenRef = useRef(0);
	const hasInitialSyncRef = useRef(false);

	const suggestionFetchInFlight = useSyncExternalStore(
		subscribeSuggestionFetchInFlight,
		getSuggestionFetchInFlight,
		() => false,
	);

	const utils = api.useUtils();

	const setMutation = api.preference.set.useMutation({
		onSuccess: (data) => {
			utils.preference.get.setData(undefined, data);
		},
	});

	useEffect(() => {
		if (isGuest) {
			setMountSettled(true);
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			setMountSettled(true);
		});
		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [isGuest]);

	useEffect(() => {
		const nextScope: OnboardingScope = isGuest
			? { mode: "guest" }
			: { mode: "authenticated", userId: userId ?? "" };
		scopeRef.current = nextScope;
		setModeState(readCycleEndAudioMode(nextScope));
		setIsHydrated(isGuest);
		guestMergeAttemptedRef.current = false;
		guestMergeGenRef.current += 1;
		hasInitialSyncRef.current = false;
	}, [isGuest, userId]);

	const preferenceQueryEnabled =
		!isGuest && userId != null && mountSettled && !suggestionFetchInFlight;

	const preferenceQuery = api.preference.get.useQuery(undefined, {
		enabled: preferenceQueryEnabled,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: setMutation omitted to avoid spurious re-sync on identity change
	useEffect(() => {
		if (isGuest || userId == null) {
			return;
		}

		if (suggestionFetchInFlight || !preferenceQuery.isFetched) {
			return;
		}

		const mergeGen = ++guestMergeGenRef.current;

		void (async () => {
			await waitUntilSuggestionIdle();
			if (guestMergeGenRef.current !== mergeGen) {
				return;
			}

			if (hasInitialSyncRef.current) {
				return;
			}

			const serverMode =
				preferenceQuery.data?.cycleEndAudioMode ?? DEFAULT_CYCLE_END_AUDIO_MODE;

			if (!guestMergeAttemptedRef.current) {
				guestMergeAttemptedRef.current = true;
				const guestMode = readGuestModeForMerge();
				if (guestMode != null && serverMode === DEFAULT_CYCLE_END_AUDIO_MODE) {
					setModeState(guestMode);
					writeCycleEndAudioMode(scopeRef.current, guestMode);
					await waitUntilSuggestionIdle();
					if (guestMergeGenRef.current !== mergeGen) {
						return;
					}
					await setMutation.mutateAsync({ cycleEndAudioMode: guestMode });
					setIsHydrated(true);
					hasInitialSyncRef.current = true;
					return;
				}
			}

			setModeState(serverMode);
			writeCycleEndAudioMode(scopeRef.current, serverMode);
			setIsHydrated(true);
			hasInitialSyncRef.current = true;
		})();
	}, [
		isGuest,
		userId,
		suggestionFetchInFlight,
		preferenceQuery.isFetched,
		preferenceQuery.data,
	]);

	const setMode = useCallback(
		(next: CycleEndAudioMode) => {
			setModeState(next);
			writeCycleEndAudioMode(scopeRef.current, next);
			if (!isGuest && userId != null) {
				void (async () => {
					await waitUntilSuggestionIdle();
					setMutation.mutate({ cycleEndAudioMode: next });
				})();
			}
		},
		[isGuest, userId, setMutation],
	);

	return { mode, setMode, isHydrated };
}
