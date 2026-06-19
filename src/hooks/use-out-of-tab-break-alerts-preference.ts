"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
	readOutOfTabBreakAlertsEnabled,
	writeOutOfTabBreakAlertsEnabled,
} from "~/lib/break-out-of-tab-alert/storage";
import type { OnboardingScope } from "~/lib/onboarding/types";

export function useOutOfTabBreakAlertsPreference(scope: OnboardingScope) {
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	const [enabled, setEnabledState] = useState(() =>
		readOutOfTabBreakAlertsEnabled(scope),
	);

	useEffect(() => {
		setEnabledState(readOutOfTabBreakAlertsEnabled(scope));
	}, [scope]);

	const setEnabled = useCallback((next: boolean) => {
		setEnabledState(next);
		writeOutOfTabBreakAlertsEnabled(scopeRef.current, next);
	}, []);

	return { enabled, setEnabled };
}
