/** Calm session narrative strings (S-17, FR-040). */

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

export const INTENTION_CHIP_OPTIONS = [
	{ testId: "deep-work", label: "Deep work" },
	{ testId: "clear-inbox", label: "Clear inbox" },
	{ testId: "ship-feature", label: "Ship a feature" },
] as const;
