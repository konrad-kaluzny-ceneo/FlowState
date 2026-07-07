import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

import type { CatchUpGate } from "./types";

export type CatchUpCopyContext = {
	taskTitle?: string;
	cycleKind?: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	endedAgo: string;
};

export type CatchUpCopy = {
	headline: string;
	subcopy: string;
};

function catchUpT(locale: UserLocale) {
	return createNamespaceTranslator("CatchUp", locale);
}

function breakLabel(
	cycleKind: CatchUpCopyContext["cycleKind"],
	locale: UserLocale,
): string {
	const t = catchUpT(locale);
	if (cycleKind === "LONG_BREAK") {
		return t("longBreak");
	}
	if (cycleKind === "SHORT_BREAK") {
		return t("shortBreak");
	}
	return t("break");
}

export function getCatchUpCopy(
	gate: CatchUpGate,
	ctx: CatchUpCopyContext,
	locale: UserLocale = "en",
): CatchUpCopy {
	const t = catchUpT(locale);

	switch (gate) {
		case "WORK_CONFIRM": {
			const title = ctx.taskTitle?.trim() || t("workCycleLabel");
			return {
				headline: t("workConfirmHeadline", { title }),
				subcopy: t("workConfirmSubcopy"),
			};
		}
		case "BREAK_CONFIRM":
			return {
				headline: t("breakConfirmHeadline", {
					label: breakLabel(ctx.cycleKind, locale),
				}),
				subcopy: t("breakConfirmSubcopy"),
			};
		case "CHECK_IN":
			return {
				headline: t("checkInHeadline"),
				subcopy: t("checkInSubcopy"),
			};
	}
}
