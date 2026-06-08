"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
	const guestMergeAttemptedRef = useRef(false);

	const preferenceQuery = api.preference.get.useQuery(undefined, {
		enabled: !isGuest && userId != null,
	});

	const setMutation = api.preference.set.useMutation();

	useEffect(() => {
		setModeState(readCycleEndAudioMode(scope));
		setIsHydrated(isGuest);
		guestMergeAttemptedRef.current = false;
	}, [scope, isGuest]);

	useEffect(() => {
		if (isGuest || userId == null) {
			return;
		}

		if (!preferenceQuery.isFetched) {
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
				setMutation.mutate({ cycleEndAudioMode: guestMode });
				setIsHydrated(true);
				return;
			}
		}

		setModeState(serverMode);
		writeCycleEndAudioMode(scopeRef.current, serverMode);
		setIsHydrated(true);
	}, [
		isGuest,
		userId,
		preferenceQuery.isFetched,
		preferenceQuery.data,
		setMutation,
	]);

	const setMode = useCallback(
		(next: CycleEndAudioMode) => {
			setModeState(next);
			writeCycleEndAudioMode(scopeRef.current, next);
			if (!isGuest && userId != null) {
				setMutation.mutate({ cycleEndAudioMode: next });
			}
		},
		[isGuest, userId, setMutation],
	);

	return { mode, setMode, isHydrated };
}
