import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

/** F-14 acceptance: home purpose header for the 5-second purpose test (S-40 cites). */
export function getHomePurposeHeader(locale: UserLocale = "en"): string {
	return createNamespaceTranslator("Home", locale)("purposeHeader");
}
