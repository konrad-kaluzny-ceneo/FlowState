"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { OnboardingScope } from "~/lib/onboarding/types";
import {
	readWorkspaceSetupState,
	toggleDoneTip,
	writeNudgeDismissed,
} from "~/lib/workspace-setup-advisor/storage";
import type { WorkspaceTipId } from "~/lib/workspace-setup-advisor/types";

export function useWorkspaceSetupChecklist(scope: OnboardingScope) {
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	const [state, setState] = useState(() => readWorkspaceSetupState(scope));

	useEffect(() => {
		setState(readWorkspaceSetupState(scope));
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
		nudgeDismissed: state.nudgeDismissed,
		toggleTip,
		dismissNudge,
	};
}
