"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

const TIP_KEYS = ["tip0", "tip1", "tip2", "tip3", "tip4", "tip5"] as const;

function dayOfYear(date: Date): number {
	const start = Date.UTC(date.getUTCFullYear(), 0, 1);
	const current = Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
	);
	return Math.floor((current - start) / 86_400_000);
}

export function FocusTip() {
	const t = useTranslations("FocusTip");
	const tipKey = useMemo(() => {
		const index = dayOfYear(new Date()) % TIP_KEYS.length;
		return TIP_KEYS[index] ?? TIP_KEYS[0];
	}, []);

	return (
		<div
			className="w-full rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-3"
			data-testid="focus-tip"
		>
			<p className="font-medium text-text-secondary text-xs">{t("heading")}</p>
			<p className="mt-1 text-sm text-text-primary">{t(tipKey)}</p>
		</div>
	);
}
