/** Invitational overlay copy for the mindful session wind-down gate (S-16, FR-019–FR-021). */

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

function windDownT(locale: UserLocale) {
	return createNamespaceTranslator("Session.windDown", locale);
}

export function getWindDownTitle(locale: UserLocale = "en"): string {
	return windDownT(locale)("title");
}

export function getWindDownBody(locale: UserLocale = "en"): string {
	return windDownT(locale)("body");
}

export function getWindDownKeepGoingLabel(locale: UserLocale = "en"): string {
	return windDownT(locale)("keepGoing");
}

export function getWindDownEndSessionLabel(locale: UserLocale = "en"): string {
	return windDownT(locale)("endSession");
}

/** @deprecated Use getWindDownTitle(locale) */
export const WIND_DOWN_TITLE = getWindDownTitle();

/** @deprecated Use getWindDownBody(locale) */
export const WIND_DOWN_BODY = getWindDownBody();

/** @deprecated Use getWindDownKeepGoingLabel(locale) */
export const WIND_DOWN_KEEP_GOING_LABEL = getWindDownKeepGoingLabel();

/** @deprecated Use getWindDownEndSessionLabel(locale) */
export const WIND_DOWN_END_SESSION_LABEL = getWindDownEndSessionLabel();
