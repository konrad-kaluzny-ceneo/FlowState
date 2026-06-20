/** Calm session narrative strings (S-17, FR-040). */

import type { WorkType } from "~/lib/domain";

export const ENERGY_LABELS = {
	FOCUSED: "focused",
	STEADY: "steady",
	FADING: "fading",
} as const;

export const CLOSURE_PREFIX = "Session complete";

export const CLOSURE_TITLE = "Session closed";

export const CLOSURE_DISMISS_LABEL = "Continue";

export const HANDOFF_LEFT_OFF_PREFIX = "Left off:";

export const HANDOFF_CONTINUE_PREFIX = "Continue:";

export const HANDOFF_DISMISS_LABEL = "Dismiss";

export const INTENTION_CHIP_OPTIONS = [
	{ testId: "deep-work", label: "Deep work" },
	{ testId: "clear-inbox", label: "Clear inbox" },
	{ testId: "ship-feature", label: "Ship a feature" },
] as const;

/** Session-focus chip labels → kickoff scoring work-type preference. */
export const INTENTION_CHIP_WORK_TYPE_MAP: Record<string, WorkType> = {
	"Deep work": "DEEP_WORK",
	"Clear inbox": "OPERATIONAL",
	"Ship a feature": "DEEP_WORK",
};

export function resolveIntentionWorkType(
	intention: string | null | undefined,
): WorkType | undefined {
	if (intention == null) {
		return undefined;
	}
	const trimmed = intention.trim();
	if (trimmed.length === 0) {
		return undefined;
	}
	return INTENTION_CHIP_WORK_TYPE_MAP[trimmed];
}
