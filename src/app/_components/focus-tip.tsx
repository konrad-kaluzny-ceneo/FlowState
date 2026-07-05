"use client";

import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { FocusWidgetCard } from "~/app/_components/focus-widget-card";
import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";

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

type FocusTipProps = {
	variant?: "inline" | "widget";
};

export function FocusTip({ variant = "widget" }: FocusTipProps) {
	const t = useTranslations("FocusTip");
	const tipKey = useMemo(() => {
		const index = dayOfYear(new Date()) % TIP_KEYS.length;
		return TIP_KEYS[index] ?? TIP_KEYS[0];
	}, []);

	const body = (
		<>
			<p className="text-pretty font-medium text-primary text-sm leading-relaxed">
				{t(tipKey)}
			</p>
			{variant === "widget" && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-2 bottom-1 opacity-25"
				>
					<CalmGardenSprig className="h-14 w-14" variant="idle" />
				</div>
			)}
		</>
	);

	if (variant === "inline") {
		return (
			<div
				className="w-full rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-3"
				data-testid="focus-tip"
			>
				<p className="font-medium text-text-secondary text-xs">
					{t("heading")}
				</p>
				<p className="mt-1 text-sm text-text-primary">{t(tipKey)}</p>
			</div>
		);
	}

	return (
		<FocusWidgetCard
			className="relative overflow-hidden"
			icon={<Lightbulb className="h-4 w-4 text-accent-cta" />}
			testId="focus-tip"
			title={t("heading")}
		>
			{body}
		</FocusWidgetCard>
	);
}
