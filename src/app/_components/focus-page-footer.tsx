"use client";

import { useTranslations } from "next-intl";

import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";

export function FocusPageFooter() {
	const t = useTranslations("FocusPage");

	return (
		<footer
			className="flex w-full items-center justify-center gap-2 py-4 text-center text-sm text-text-dimmed"
			data-testid="focus-page-footer"
		>
			<CalmGardenSprig className="h-4 w-4 opacity-70" variant="idle" />
			<p>{t("footer")}</p>
		</footer>
	);
}
