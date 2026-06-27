/** Calm session narrative strings (S-17, FR-040). */

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { WorkType } from "~/lib/domain";
import type { EnergyLevel } from "~/lib/domain/energy-level";
import type { UserLocale } from "~/lib/domain/user-locale";

const INTENTION_CHIP_DEFS = [
	{ testId: "deep-work", messageKey: "intentionDeepWork" },
	{ testId: "clear-inbox", messageKey: "intentionClearInbox" },
	{ testId: "ship-feature", messageKey: "intentionShipFeature" },
] as const;

const INTENTION_CHIP_WORK_TYPE_BY_TEST_ID: Record<string, WorkType> = {
	"deep-work": "DEEP_WORK",
	"clear-inbox": "OPERATIONAL",
	"ship-feature": "DEEP_WORK",
};

function narrativeT(locale: UserLocale) {
	return createNamespaceTranslator("Session.narrative", locale);
}

export function getEnergyLabel(
	energy: EnergyLevel,
	locale: UserLocale = "en",
): string {
	const t = narrativeT(locale);
	switch (energy) {
		case "FOCUSED":
			return t("energyFocused");
		case "STEADY":
			return t("energySteady");
		case "FADING":
			return t("energyFading");
	}
}

/** @deprecated Use getEnergyLabel(energy, locale) */
export const ENERGY_LABELS = {
	FOCUSED: getEnergyLabel("FOCUSED"),
	STEADY: getEnergyLabel("STEADY"),
	FADING: getEnergyLabel("FADING"),
} as const;

export function getClosurePrefix(locale: UserLocale = "en"): string {
	return narrativeT(locale)("closurePrefix");
}

export function getClosureTitle(locale: UserLocale = "en"): string {
	return narrativeT(locale)("closureTitle");
}

export function getClosureDismissLabel(locale: UserLocale = "en"): string {
	return narrativeT(locale)("closureDismiss");
}

export function getHandoffLeftOffPrefix(locale: UserLocale = "en"): string {
	return narrativeT(locale)("handoffLeftOff");
}

export function getHandoffContinuePrefix(locale: UserLocale = "en"): string {
	return narrativeT(locale)("handoffContinue");
}

export function getHandoffDismissLabel(locale: UserLocale = "en"): string {
	return narrativeT(locale)("handoffDismiss");
}

export function getIntentionChipOptions(locale: UserLocale = "en") {
	const t = narrativeT(locale);
	return INTENTION_CHIP_DEFS.map((chip) => ({
		testId: chip.testId,
		label: t(chip.messageKey),
	}));
}

/** @deprecated Use getClosurePrefix(locale) */
export const CLOSURE_PREFIX = getClosurePrefix();

/** @deprecated Use getClosureTitle(locale) */
export const CLOSURE_TITLE = getClosureTitle();

/** @deprecated Use getClosureDismissLabel(locale) */
export const CLOSURE_DISMISS_LABEL = getClosureDismissLabel();

/** @deprecated Use getHandoffLeftOffPrefix(locale) */
export const HANDOFF_LEFT_OFF_PREFIX = getHandoffLeftOffPrefix();

/** @deprecated Use getHandoffContinuePrefix(locale) */
export const HANDOFF_CONTINUE_PREFIX = getHandoffContinuePrefix();

/** @deprecated Use getHandoffDismissLabel(locale) */
export const HANDOFF_DISMISS_LABEL = getHandoffDismissLabel();

/** @deprecated Use getIntentionChipOptions(locale) */
export const INTENTION_CHIP_OPTIONS = getIntentionChipOptions();

export function resolveIntentionWorkType(
	intention: string | null | undefined,
	locale: UserLocale = "en",
): WorkType | undefined {
	if (intention == null) {
		return undefined;
	}
	const trimmed = intention.trim();
	if (trimmed.length === 0) {
		return undefined;
	}

	const options = getIntentionChipOptions(locale);
	const match = options.find((chip) => chip.label === trimmed);
	if (match == null) {
		return undefined;
	}
	return INTENTION_CHIP_WORK_TYPE_BY_TEST_ID[match.testId];
}

function dayMemoryT(locale: UserLocale) {
	return createNamespaceTranslator("DayMemory", locale);
}

export function getDayMemorySectionDone(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionDone");
}

export function getDayMemorySectionRemains(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionRemains");
}

export function getDayMemorySectionReturnTo(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionReturnTo");
}

export type DayMemoryCollapsedInput = {
	done: string;
	remaining: string;
	next: string;
};

/** F-14 acceptance: collapsed day-memory one-liner for home (S-42 formatter cites this). */
export function buildDayMemoryCollapsedLine(
	input: DayMemoryCollapsedInput,
	locale: UserLocale = "en",
): string {
	return dayMemoryT(locale)("collapsedLine", input);
}
