/** Confirm overlay copy for ending a session while a cycle is running or paused (B-08, T-04). */

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export type EndSessionConfirmVariant = "immediate" | "after-pause";

/** WORK vs break — S-38 wording applies only during WORK blocks. */
export type EndSessionCycleContext = "work" | "break";

function endSessionT(locale: UserLocale) {
	return createNamespaceTranslator("Session.endSession", locale);
}

export function getEndSessionConfirmCopy(
	variant: EndSessionConfirmVariant,
	cycleContext: EndSessionCycleContext = "work",
	locale: UserLocale = "en",
) {
	const t = endSessionT(locale);

	if (variant === "after-pause") {
		return {
			title: t("pauseTitle"),
			body: cycleContext === "work" ? t("pauseBodyWork") : t("pauseBodyBreak"),
			confirmLabel: t("confirmLabel"),
			cancelLabel: t("pauseCancelLabel"),
		};
	}

	return {
		title: t("title"),
		body: cycleContext === "work" ? t("bodyWork") : t("bodyBreak"),
		confirmLabel: t("confirmLabel"),
		cancelLabel: t("cancelLabel"),
	};
}

/** @deprecated Use getEndSessionConfirmCopy — EN defaults for tests */
export const END_SESSION_CONFIRM_TITLE = endSessionT("en")("title");
export const END_SESSION_CONFIRM_BODY = endSessionT("en")("bodyWork");
export const END_SESSION_BREAK_CONFIRM_BODY = endSessionT("en")("bodyBreak");
export const END_SESSION_CONFIRM_LABEL = endSessionT("en")("confirmLabel");
export const END_SESSION_CONFIRM_CANCEL_LABEL =
	endSessionT("en")("cancelLabel");
export const PAUSE_AND_END_SESSION_CONFIRM_TITLE =
	endSessionT("en")("pauseTitle");
export const PAUSE_AND_END_SESSION_CONFIRM_BODY =
	endSessionT("en")("pauseBodyWork");
export const PAUSE_AND_END_SESSION_BREAK_CONFIRM_BODY =
	endSessionT("en")("pauseBodyBreak");
export const PAUSE_AND_END_SESSION_CONFIRM_LABEL =
	endSessionT("en")("confirmLabel");
export const PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL =
	endSessionT("en")("pauseCancelLabel");
