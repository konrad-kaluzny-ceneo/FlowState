/** Shown briefly when the user overrides a post-check-in task suggestion (FR-022). */

import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export const OVERRIDE_ACK_VISIBLE_MS = 3_000;

export function getOverrideAckLine(locale: UserLocale = "en"): string {
	return createNamespaceTranslator("Suggestion", locale)("overrideAck");
}

/** @deprecated Use getOverrideAckLine(locale) */
export const OVERRIDE_ACK_LINE = getOverrideAckLine();
