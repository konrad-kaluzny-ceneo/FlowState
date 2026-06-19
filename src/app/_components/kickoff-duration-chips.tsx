"use client";

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

function formatMinutesLabel(sec: number): string {
	const minutes = Math.round(sec / 60);
	return `${minutes} min`;
}

export function KickoffDurationChips({
	workType,
	scope,
	selectedSec,
	onSelect,
}: KickoffDurationChipsProps) {
	const chipSec = resolveKickoffChipSec(workType, scope);
	const remembered = getWorkTypeDuration(workType, scope) != null;
	const label = remembered ? "your usual" : formatMinutesLabel(chipSec);

	return (
		<div
			className="flex w-full max-w-lg flex-col items-center gap-2"
			data-testid="kickoff-duration-chips"
		>
			<p className="text-sm text-text-secondary">Suggested work duration</p>
			<button
				aria-label={
					remembered
						? `Your usual duration, ${formatMinutesLabel(chipSec)}`
						: formatMinutesLabel(chipSec)
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
