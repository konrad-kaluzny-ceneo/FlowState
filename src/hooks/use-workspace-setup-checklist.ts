"use client";

import { useCallback, useEffect, useState } from "react";

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
	// SSR-safe: defaults on server; hydrate from localStorage on client mount.
	const [state, setState] = useState(DEFAULT_WORKSPACE_SETUP_STATE);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		setState(readWorkspaceSetupState(scope));
		setHydrated(true);
	}, [scope]);

	// Bind writes to the committed `scope` (not a render-phase ref) so an
	// interrupted guest/auth transition cannot persist under a stale scope.
	const toggleTip = useCallback(
		(id: WorkspaceTipId) => {
			setState(toggleDoneTip(scope, id));
		},
		[scope],
	);

	const dismissNudge = useCallback(() => {
		setState(writeNudgeDismissed(scope, true));
	}, [scope]);

	return {
		doneTipIds: state.doneTipIds,
		// Pessimistic true until hydrate — avoids SSR/client nudge mismatch.
		nudgeDismissed: hydrated ? state.nudgeDismissed : true,
		toggleTip,
		dismissNudge,
	};
}
