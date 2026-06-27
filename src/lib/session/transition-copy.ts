/** Calm break-start and break→work re-entry lines (S-21, FR-014). */

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { EnergyLevel } from "~/lib/domain/energy-level";
import type { UserLocale } from "~/lib/domain/user-locale";

export const BREAK_TRANSITION_VISIBLE_MS = 5_000;

export type BreakKind = "SHORT_BREAK" | "LONG_BREAK";

function transitionT(locale: UserLocale) {
	return createNamespaceTranslator("Session.transition", locale);
}

export function getBreakStartShort(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakStartShort");
}

export function getBreakStartLong(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakStartLong");
}

export function getBreakReentryFocused(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakReentryFocused");
}

export function getBreakReentrySteady(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakReentrySteady");
}

export function getBreakReentryFading(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakReentryFading");
}

export function getBreakReentryNeutral(locale: UserLocale = "en"): string {
	return transitionT(locale)("breakReentryNeutral");
}

/** @deprecated Use getBreakStartShort(locale) */
export const BREAK_START_SHORT = getBreakStartShort();

/** @deprecated Use getBreakStartLong(locale) */
export const BREAK_START_LONG = getBreakStartLong();

/** @deprecated Use getBreakReentryFocused(locale) */
export const BREAK_REENTRY_FOCUSED = getBreakReentryFocused();

/** @deprecated Use getBreakReentrySteady(locale) */
export const BREAK_REENTRY_STEADY = getBreakReentrySteady();

/** @deprecated Use getBreakReentryFading(locale) */
export const BREAK_REENTRY_FADING = getBreakReentryFading();

/** @deprecated Use getBreakReentryNeutral(locale) */
export const BREAK_REENTRY_NEUTRAL = getBreakReentryNeutral();

export function getBreakStartLine(
	breakKind: BreakKind,
	locale: UserLocale = "en",
): string {
	return breakKind === "LONG_BREAK"
		? getBreakStartLong(locale)
		: getBreakStartShort(locale);
}

export function getBreakReentryLine(
	energy: EnergyLevel | null,
	locale: UserLocale = "en",
): string {
	if (energy === "FOCUSED") {
		return getBreakReentryFocused(locale);
	}
	if (energy === "STEADY") {
		return getBreakReentrySteady(locale);
	}
	if (energy === "FADING") {
		return getBreakReentryFading(locale);
	}
	return getBreakReentryNeutral(locale);
}
