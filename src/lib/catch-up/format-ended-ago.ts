import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export function formatEndedAgo(
	endedAtMs: number,
	nowMs: number = Date.now(),
	locale: UserLocale = "en",
): string {
	const t = createNamespaceTranslator("CatchUp.endedAgo", locale);
	const elapsedSec = Math.max(0, Math.floor((nowMs - endedAtMs) / 1000));

	if (elapsedSec < 10) {
		return t("justNow");
	}

	if (elapsedSec < 60) {
		return t("secondsAgo", { count: elapsedSec });
	}

	const elapsedMin = Math.floor(elapsedSec / 60);
	if (elapsedMin < 60) {
		return elapsedMin === 1
			? t("minuteAgo")
			: t("minutesAgo", { count: elapsedMin });
	}

	const elapsedHr = Math.floor(elapsedMin / 60);
	return elapsedHr === 1 ? t("hourAgo") : t("hoursAgo", { count: elapsedHr });
}
