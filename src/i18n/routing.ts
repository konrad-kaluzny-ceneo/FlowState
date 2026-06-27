import { defineRouting } from "next-intl/routing";

import {
	DEFAULT_USER_LOCALE,
	userLocaleSchema,
} from "~/lib/domain/user-locale";

export const LOCALE_COOKIE_NAME = "flowstate-locale";

export const routing = defineRouting({
	locales: [...userLocaleSchema],
	defaultLocale: DEFAULT_USER_LOCALE,
	localePrefix: "never",
	localeCookie: {
		name: LOCALE_COOKIE_NAME,
	},
});
