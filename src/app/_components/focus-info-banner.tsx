"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";

type FocusInfoBannerProps = {
	variant: "empty" | "ready";
};

export function FocusInfoBanner({ variant }: FocusInfoBannerProps) {
	const t = useTranslations("FocusInfoBanner");

	return (
		<div
			className="focus-info-banner flex w-full items-center gap-3 rounded-card border border-accent-cta/15 px-4 py-3 shadow-sm"
			data-testid="focus-info-banner"
		>
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-cta/10">
				<CalmGardenSprig className="h-5 w-5" variant="idle" />
			</div>
			<p className="flex-1 text-pretty text-sm text-text-secondary">
				{t(variant)}
			</p>
			<ArrowUpRight
				aria-hidden="true"
				className="h-4 w-4 shrink-0 text-accent-cta"
			/>
		</div>
	);
}
