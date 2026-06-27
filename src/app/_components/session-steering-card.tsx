"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
	type CheckInEnergy,
	EnergySelector,
} from "~/app/_components/energy-selector";
import { overlayButtonClass } from "~/app/_components/overlay-shell";
import type { UserLocale } from "~/lib/domain/user-locale";
import { getIntentionChipOptions } from "~/lib/session/narrative-copy";

type SessionEnergyCardProps = {
	onSelect: (energy: CheckInEnergy) => void;
	onSkip: () => void;
	disabled?: boolean;
};

export function SessionEnergyCard({
	onSelect,
	onSkip,
	disabled = false,
}: SessionEnergyCardProps) {
	const t = useTranslations("SessionSteering");

	return (
		<section
			aria-labelledby="session-energy-heading"
			className="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-panel/80 p-5 shadow-sm"
			data-testid="session-energy-card"
		>
			<h2
				className="font-semibold text-lg text-primary"
				id="session-energy-heading"
			>
				{t("energyHeading")}
			</h2>
			<p className="mt-1 text-sm text-text-secondary">{t("energyBody")}</p>
			<EnergySelector disabled={disabled} onSelect={onSelect} />
			<button
				className={`${overlayButtonClass.secondary} mt-3 w-full py-2 text-sm text-text-dimmed hover:text-text-secondary sm:py-2.5`}
				data-testid="session-energy-skip-btn"
				disabled={disabled}
				onClick={onSkip}
				type="button"
			>
				{t("energySkip")}
			</button>
		</section>
	);
}

type SessionFocusCardProps = {
	onComplete: (intention: string) => void;
	onSkip: () => void;
	isSubmitting?: boolean;
};

export function SessionFocusCard({
	onComplete,
	onSkip,
	isSubmitting = false,
}: SessionFocusCardProps) {
	const locale = useLocale() as UserLocale;
	const t = useTranslations("SessionSteering");
	const [customIntention, setCustomIntention] = useState("");
	const intentionChips = getIntentionChipOptions(locale);

	const handleChipSelect = (label: string) => {
		onComplete(label);
	};

	const handleCustomSubmit = () => {
		const trimmed = customIntention.trim();
		if (trimmed.length === 0) {
			return;
		}
		onComplete(trimmed);
	};

	return (
		<section
			aria-labelledby="session-focus-heading"
			className="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-panel/80 p-5 shadow-sm"
			data-testid="session-focus-card"
		>
			<h2
				className="font-semibold text-lg text-primary"
				id="session-focus-heading"
			>
				{t("focusHeading")}
			</h2>
			<p className="mt-1 text-sm text-text-secondary">{t("focusBody")}</p>
			<fieldset className="mt-4 border-0 p-0">
				<legend className="sr-only">{t("focusLegend")}</legend>
				<div className="flex flex-wrap gap-2">
					{intentionChips.map((chip) => (
						<button
							className="rounded-lg bg-segment-inactive px-3 py-2 text-sm text-text-secondary transition hover:bg-surface-panel disabled:opacity-40"
							data-testid={`steering-intention-${chip.testId}`}
							disabled={isSubmitting}
							key={chip.testId}
							onClick={() => handleChipSelect(chip.label)}
							type="button"
						>
							{chip.label}
						</button>
					))}
				</div>
			</fieldset>
			<input
				aria-label={t("focusCustomAria")}
				className="mt-3 w-full rounded-lg border border-border-subtle bg-surface-panel px-3 py-2 text-sm text-text-primary placeholder:text-text-dimmed"
				data-testid="steering-intention-input"
				disabled={isSubmitting}
				maxLength={80}
				onChange={(event) => setCustomIntention(event.target.value)}
				placeholder={t("focusCustomPlaceholder")}
				value={customIntention}
			/>
			<div className="mt-3 flex flex-col gap-2 sm:flex-row">
				<button
					className={`${overlayButtonClass.primary} w-full flex-1 py-2 text-sm sm:py-2.5`}
					data-testid="steering-intention-submit-btn"
					disabled={isSubmitting || customIntention.trim().length === 0}
					onClick={handleCustomSubmit}
					type="button"
				>
					{t("focusCustomSubmit")}
				</button>
				<button
					className={`${overlayButtonClass.secondary} w-full flex-1 py-2 text-sm text-text-dimmed hover:text-text-secondary sm:py-2.5`}
					data-testid="session-focus-skip-btn"
					disabled={isSubmitting}
					onClick={onSkip}
					type="button"
				>
					{t("focusSkip")}
				</button>
			</div>
		</section>
	);
}
