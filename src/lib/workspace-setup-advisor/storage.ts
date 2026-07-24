import type { OnboardingScope } from "~/lib/onboarding/types";

import { workspaceSetupKeyForScope } from "./keys";
import { filterKnownTipIds } from "./tips";
import {
	DEFAULT_WORKSPACE_SETUP_STATE,
	type WorkspaceSetupState,
	type WorkspaceTipId,
} from "./types";

const STORAGE_VERSION = 1;

type StoredWorkspaceSetupState = {
	v?: number;
	doneTipIds?: unknown;
	nudgeDismissed?: unknown;
};

function parseStoredState(raw: string | null): WorkspaceSetupState {
	if (raw == null) {
		return { ...DEFAULT_WORKSPACE_SETUP_STATE };
	}

	try {
		const parsed = JSON.parse(raw) as StoredWorkspaceSetupState;
		const doneTipIds = Array.isArray(parsed.doneTipIds)
			? filterKnownTipIds(
					parsed.doneTipIds.filter(
						(id): id is string => typeof id === "string",
					),
				)
			: [];

		return {
			doneTipIds,
			nudgeDismissed: parsed.nudgeDismissed === true,
		};
	} catch {
		return { ...DEFAULT_WORKSPACE_SETUP_STATE };
	}
}

function saveState(scope: OnboardingScope, state: WorkspaceSetupState): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = workspaceSetupKeyForScope(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(
			key,
			JSON.stringify({
				v: STORAGE_VERSION,
				doneTipIds: state.doneTipIds,
				nudgeDismissed: state.nudgeDismissed,
			}),
		);
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}

export function readWorkspaceSetupState(
	scope: OnboardingScope,
): WorkspaceSetupState {
	if (typeof window === "undefined") {
		return { ...DEFAULT_WORKSPACE_SETUP_STATE };
	}

	const key = workspaceSetupKeyForScope(scope);
	if (key == null) {
		return { ...DEFAULT_WORKSPACE_SETUP_STATE };
	}

	try {
		return parseStoredState(localStorage.getItem(key));
	} catch {
		return { ...DEFAULT_WORKSPACE_SETUP_STATE };
	}
}

export function writeDoneTipIds(
	scope: OnboardingScope,
	ids: readonly WorkspaceTipId[],
): WorkspaceSetupState {
	const current = readWorkspaceSetupState(scope);
	const next: WorkspaceSetupState = {
		...current,
		doneTipIds: filterKnownTipIds(ids),
	};
	saveState(scope, next);
	return next;
}

export function toggleDoneTip(
	scope: OnboardingScope,
	id: WorkspaceTipId,
): WorkspaceSetupState {
	const current = readWorkspaceSetupState(scope);
	const has = current.doneTipIds.includes(id);
	const doneTipIds = has
		? current.doneTipIds.filter((tipId) => tipId !== id)
		: [...current.doneTipIds, id];

	const next: WorkspaceSetupState = {
		...current,
		doneTipIds,
	};
	saveState(scope, next);
	return next;
}

export function writeNudgeDismissed(
	scope: OnboardingScope,
	dismissed: boolean,
): WorkspaceSetupState {
	const current = readWorkspaceSetupState(scope);
	const next: WorkspaceSetupState = {
		...current,
		nudgeDismissed: dismissed,
	};
	saveState(scope, next);
	return next;
}
