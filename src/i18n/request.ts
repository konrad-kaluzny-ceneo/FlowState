import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE_NAME } from "~/i18n/routing";
import { auth } from "~/lib/auth/server";
import {
	languageFromPreferenceRow,
	resolveRequestLocale,
} from "~/lib/language-preference/resolve-request-locale";
import { db } from "~/server/db";

export default getRequestConfig(async () => {
	const cookieStore = await cookies();
	const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

	let authenticatedLanguage = null;
	let isAuthenticated = false;

	try {
		const result = await auth.getSession();
		const userId = result.data?.user?.id;
		if (userId) {
			isAuthenticated = true;
			const row = await db.userPreference.findUnique({
				where: { userId },
				select: { language: true },
			});
			authenticatedLanguage = languageFromPreferenceRow(row?.language);
		}
	} catch {
		// Session unavailable — fall back to cookie/default locale.
	}

	const locale = resolveRequestLocale({
		cookieLocale,
		authenticatedLanguage,
		isAuthenticated,
	});

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
