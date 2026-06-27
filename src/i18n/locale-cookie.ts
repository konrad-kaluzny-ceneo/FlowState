import type { NextRequest, NextResponse } from "next/server";
import { detectLocaleFromAcceptLanguage } from "~/i18n/accept-language";
import { LOCALE_COOKIE_NAME } from "~/i18n/routing";
import { isUserLocale } from "~/lib/domain/user-locale";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readLocaleCookie(request: NextRequest): string | undefined {
	return request.cookies.get(LOCALE_COOKIE_NAME)?.value;
}

export function ensureLocaleCookie(
	request: NextRequest,
	response: NextResponse,
): NextResponse {
	const existing = readLocaleCookie(request);
	if (existing && isUserLocale(existing)) {
		return response;
	}

	const locale = detectLocaleFromAcceptLanguage(
		request.headers.get("accept-language"),
	);

	response.cookies.set(LOCALE_COOKIE_NAME, locale, {
		path: "/",
		sameSite: "lax",
		maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
	});

	return response;
}
