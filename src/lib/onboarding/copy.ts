import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export type FirstRunMode = "guest" | "authenticated";

export type FirstRunCopy = {
	title: string;
	body: string;
	dismissLabel: string;
};

export function getFirstRunCopy(
	mode: FirstRunMode,
	locale: UserLocale = "en",
): FirstRunCopy {
	const t = createNamespaceTranslator("Onboarding.firstRun", locale);
	const key = mode === "guest" ? "guest" : "authenticated";

	return {
		title: t(`${key}.title`),
		body: t(`${key}.body`),
		dismissLabel: t(`${key}.dismissLabel`),
	};
}

export function getCheckInCoachLine(locale: UserLocale = "en"): string {
	return createNamespaceTranslator("Onboarding.coach", locale)("checkIn");
}

export function getSuggestionCoachLine(locale: UserLocale = "en"): string {
	return createNamespaceTranslator("Onboarding.coach", locale)("suggestion");
}

export function getPostMergeCheckInCoachLine(
	locale: UserLocale = "en",
): string {
	return createNamespaceTranslator(
		"Onboarding.coach",
		locale,
	)("postMergeCheckIn");
}

export function getPostMergeSuggestionCoachLine(
	personaPresetLabel: string | null,
	locale: UserLocale = "en",
): string {
	const t = createNamespaceTranslator("Onboarding.coach", locale);
	if (personaPresetLabel != null && personaPresetLabel.length > 0) {
		return t("postMergeSuggestionWithPreset", { preset: personaPresetLabel });
	}
	return t("postMergeSuggestion");
}

export function getPresetCoachLine(locale: UserLocale = "en"): string {
	return createNamespaceTranslator("Onboarding.coach", locale)("preset");
}

/** @deprecated Use getCheckInCoachLine(locale) — EN default for test compatibility. */
export const CHECK_IN_COACH_LINE = getCheckInCoachLine();

/** @deprecated Use getSuggestionCoachLine(locale) */
export const SUGGESTION_COACH_LINE = getSuggestionCoachLine();

/** @deprecated Use getPostMergeCheckInCoachLine(locale) */
export const POST_MERGE_CHECK_IN_COACH_LINE = getPostMergeCheckInCoachLine();

/** @deprecated Use getPostMergeSuggestionCoachLine(null, locale) */
export const POST_MERGE_SUGGESTION_COACH_LINE =
	getPostMergeSuggestionCoachLine(null);

/** @deprecated Use getPostMergeSuggestionCoachLine with preset */
export const POST_MERGE_SUGGESTION_COACH_WITH_PRESET_LINE =
	"Your {preset} preset helped shape this pick — accept it or choose any task.";

/** @deprecated Use getPresetCoachLine(locale) */
export const PRESET_COACH_LINE = getPresetCoachLine();

export type AuthPageVariant = "sign-in" | "sign-up";

export type AuthValueCopy = {
	subtitle?: string;
	valueBlock?: { heading: string; lines: string[] };
};

export function getAuthValueCopy(
	variant: AuthPageVariant,
	locale: UserLocale = "en",
): AuthValueCopy {
	const t = createNamespaceTranslator("Onboarding.authValue", locale);

	if (variant === "sign-in") {
		return {
			subtitle: t("signInSubtitle"),
		};
	}

	return {
		valueBlock: {
			heading: t("signUpHeading"),
			lines: [t("signUpLine1"), t("signUpLine2"), t("signUpLine3")],
		},
	};
}
