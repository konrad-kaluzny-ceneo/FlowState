import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import type { UserLocale } from "~/lib/domain/user-locale";

import enMessages from "../../messages/en.json";
import plMessages from "../../messages/pl.json";

export function getTestMessages(locale: UserLocale = "en") {
	return locale === "pl" ? plMessages : enMessages;
}

export function withIntl(
	ui: ReactElement,
	locale: UserLocale = "en",
): ReactElement {
	return (
		<NextIntlClientProvider locale={locale} messages={getTestMessages(locale)}>
			{ui}
		</NextIntlClientProvider>
	);
}

export function IntlTestWrapper({
	children,
	locale = "en",
}: {
	children: ReactNode;
	locale?: UserLocale;
}) {
	return (
		<NextIntlClientProvider locale={locale} messages={getTestMessages(locale)}>
			{children}
		</NextIntlClientProvider>
	);
}
