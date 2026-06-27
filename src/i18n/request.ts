import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE_NAME } from "~/i18n/routing";
import { isUserLocale } from "~/lib/domain/user-locale";

export default getRequestConfig(async () => {
	const cookieStore = await cookies();
	const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

	const locale =
		cookieLocale && isUserLocale(cookieLocale) ? cookieLocale : "en";

	return {
		locale,
		messages: (await import(`../../messages/${locale}.json`)).default,
	};
});
