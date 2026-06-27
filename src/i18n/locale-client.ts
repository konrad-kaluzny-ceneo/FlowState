import type { UserLocale } from "~/lib/domain/user-locale";

import { LOCALE_COOKIE_NAME } from "./routing";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Client-side locale cookie — mirrors `ensureLocaleCookie` / explicit switch persistence. */
export function writeLocaleCookie(locale: UserLocale): void {
	if (typeof document === "undefined") {
		return;
	}

	const secure =
		typeof window !== "undefined" && window.location.protocol === "https:"
			? "; Secure"
			: "";

	// biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not universal; locale cookie must mirror proxy behavior.
	document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
