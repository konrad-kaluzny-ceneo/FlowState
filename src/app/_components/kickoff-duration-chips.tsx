"use client";

import { useTranslations } from "next-intl";

import type { WorkType } from "~/lib/domain/work-type";

import type { OnboardingScope } from "~/lib/onboarding/types";
import {
	getWorkTypeDuration,
	resolveKickoffChipSec,
} from "~/lib/work-type-duration-storage";

type KickoffDurationChipsProps = {
	workType: WorkType;
	scope: OnboardingScope;
	selectedSec?: number;
	onSelect: (sec: number) => void;
};

export function KickoffDurationChips({
	workType,
	scope,
	selectedSec,
	onSelect,
}: KickoffDurationChipsProps) {
	const t = useTranslations("Kickoff");
	const chipSec = resolveKickoffChipSec(workType, scope);
	const remembered = getWorkTypeDuration(workType, scope) != null;
	const minutes = Math.round(chipSec / 60);
	const minutesLabel = t("minutesLabel", { minutes });
	const label = remembered ? t("yourUsual") : minutesLabel;

	return (
		<div
			className="flex w-full flex-col items-center gap-2"
			data-testid="kickoff-duration-chips"
		>
			<p className="text-sm text-text-secondary">{t("suggestedDuration")}</p>
			<button
				aria-label={
					remembered
						? t("usualDurationAria", { minutes: minutesLabel })
						: minutesLabel
				}
				aria-pressed={selectedSec === chipSec}
				className={`rounded-lg px-4 py-2 text-sm transition ${
					selectedSec === chipSec
						? "bg-segment-active text-on-cta"
						: "bg-segment-inactive text-text-secondary hover:bg-surface-panel"
				}`}
				data-testid="kickoff-duration-chip"
				onClick={() => onSelect(chipSec)}
				type="button"
			>
				{label}
			</button>
		</div>
	);
}
