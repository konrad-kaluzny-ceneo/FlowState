"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OnboardingScope } from "~/lib/onboarding/types";
import {
	readWorkspaceSetupState,
	toggleDoneTip,
	writeNudgeDismissed,
} from "~/lib/workspace-setup-advisor/storage";
import {
	DEFAULT_WORKSPACE_SETUP_STATE,
	type WorkspaceTipId,
} from "~/lib/workspace-setup-advisor/types";

export function useWorkspaceSetupChecklist(scope: OnboardingScope) {
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	// SSR-safe: defaults on server; hydrate from localStorage on client mount.
	const [state, setState] = useState(DEFAULT_WORKSPACE_SETUP_STATE);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setState(readWorkspaceSetupState(scope));
		setHydrated(true);
	}, [scope]);

	const toggleTip = useCallback((id: WorkspaceTipId) => {
		const next = toggleDoneTip(scopeRef.current, id);
		setState(next);
	}, []);

	const dismissNudge = useCallback(() => {
		const next = writeNudgeDismissed(scopeRef.current, true);
		setState(next);
	}, []);

	return {
		doneTipIds: state.doneTipIds,
		// Pessimistic true until hydrate — avoids SSR/client nudge mismatch.
		nudgeDismissed: hydrated ? state.nudgeDismissed : true,
		toggleTip,
		dismissNudge,
	};
}
