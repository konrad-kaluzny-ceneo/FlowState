"use client";

import { useTranslations } from "next-intl";

export function AuthDivider() {
	const t = useTranslations("Auth");

	return (
		<div className="flex items-center gap-3">
			<div className="h-px flex-1 bg-border-subtle" />
			<span className="text-sm text-text-dimmed">{t("dividerOr")}</span>
			<div className="h-px flex-1 bg-border-subtle" />
		</div>
	);
}
