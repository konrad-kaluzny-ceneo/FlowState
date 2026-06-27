import {
	DEFAULT_USER_LOCALE,
	isUserLocale,
	type UserLocale,
} from "~/lib/domain/user-locale";
import { fromPrismaUserLocale } from "~/lib/persistence/prisma/enum-mappers";

/**
 * Request-time locale precedence:
 * explicit switch (cookie + preference, kept in sync) → authed DB preference →
 * cookie (incl. first-visit Accept-Language via proxy) → `en`.
 *
 * Authenticated users prefer stored account language over a proxy-set cookie so
 * sign-in on a new device respects account preference. Guests rely on cookie only.
 */
export function resolveRequestLocale(input: {
	cookieLocale: string | undefined;
	authenticatedLanguage: UserLocale | null;
	isAuthenticated: boolean;
}): UserLocale {
	const { cookieLocale, authenticatedLanguage, isAuthenticated } = input;

	const cookie =
		cookieLocale && isUserLocale(cookieLocale) ? cookieLocale : null;

	if (isAuthenticated) {
		if (authenticatedLanguage != null) {
			return authenticatedLanguage;
		}
		if (cookie != null) {
			return cookie;
		}
		return DEFAULT_USER_LOCALE;
	}

	if (cookie != null) {
		return cookie;
	}

	return DEFAULT_USER_LOCALE;
}

export function languageFromPreferenceRow(
	language: Parameters<typeof fromPrismaUserLocale>[0] | null | undefined,
): UserLocale | null {
	if (language == null) {
		return null;
	}

	return fromPrismaUserLocale(language);
}
