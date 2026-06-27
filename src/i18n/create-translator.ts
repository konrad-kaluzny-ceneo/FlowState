import { type AbstractIntlMessages, createTranslator } from "next-intl";

import type { UserLocale } from "~/lib/domain/user-locale";

import enMessages from "../../messages/en.json";
import plMessages from "../../messages/pl.json";

const messagesByLocale: Record<UserLocale, AbstractIntlMessages> = {
	en: enMessages,
	pl: plMessages,
};

export type CopyTranslator = (
	key: string,
	values?: Record<string, string | number | Date>,
) => string;

export function getMessagesForLocale(locale: UserLocale): AbstractIntlMessages {
	return messagesByLocale[locale];
}

/** Server-safe and test-safe translator for copy modules outside React. */
export function createNamespaceTranslator(
	namespace: string,
	locale: UserLocale = "en",
): CopyTranslator {
	const t = createTranslator({
		locale,
		messages: getMessagesForLocale(locale),
		namespace,
	});

	return (key, values) => {
		if (values == null) {
			return t(key as never);
		}
		return t(key as never, values as never);
	};
}
