import { DEFAULT_USER_LOCALE, type UserLocale } from "~/lib/domain/user-locale";

type LanguagePreference = {
	lang: string;
	quality: number;
};

function parseAcceptLanguage(header: string): LanguagePreference[] {
	return header.split(",").flatMap((part) => {
		const trimmed = part.trim();
		if (!trimmed) {
			return [];
		}

		const [rawLang, ...params] = trimmed.split(";");
		const lang = rawLang?.split("-")[0]?.toLowerCase() ?? "";
		if (!lang) {
			return [];
		}

		const qualityParam = params.find((param) => param.trim().startsWith("q="));
		const quality = qualityParam
			? Number.parseFloat(qualityParam.trim().slice(2))
			: 1;

		if (Number.isNaN(quality)) {
			return [];
		}

		return [{ lang, quality }];
	});
}

/**
 * First-visit default: Polish unless the browser clearly prefers English.
 */
export function detectLocaleFromAcceptLanguage(
	header: string | null,
): UserLocale {
	if (!header) {
		return DEFAULT_USER_LOCALE;
	}

	const preferences = parseAcceptLanguage(header);
	if (preferences.length === 0) {
		return DEFAULT_USER_LOCALE;
	}

	const polish = preferences.find((entry) => entry.lang === "pl");
	const english = preferences.find((entry) => entry.lang === "en");

	if (polish && english) {
		return polish.quality >= english.quality ? "pl" : "en";
	}
	if (english) {
		return "en";
	}
	if (polish) {
		return "pl";
	}

	return DEFAULT_USER_LOCALE;
}
