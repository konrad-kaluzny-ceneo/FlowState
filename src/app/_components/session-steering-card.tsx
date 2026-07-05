"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
	type CheckInEnergy,
	EnergySelector,
} from "~/app/_components/energy-selector";
import { overlayButtonClass } from "~/app/_components/overlay-shell";

type SessionEnergyCardProps = {
	onSelect: (energy: CheckInEnergy) => void;
	onSkip: () => void;
	disabled?: boolean;
};

/**
 * Day-start "energy of the day" gate (makieta step 1). Two-step: the user picks
 * an energy card (highlighted), then confirms with "Dalej" — a deliberate choice
 * that persists to DayPlan.energyLevel and is editable later in settings. A quiet
 * skip keeps the gate optional (and preserves the E2E dismiss path).
 */
export function SessionEnergyCard({
	onSelect,
	onSkip,
	disabled = false,
}: SessionEnergyCardProps) {
	const t = useTranslations("SessionSteering");
	const [selected, setSelected] = useState<CheckInEnergy | null>(null);

	const handleContinue = () => {
		if (selected == null) {
			return;
		}
		onSelect(selected);
	};

	return (
		<section
			aria-labelledby="session-energy-heading"
			className="w-full rounded-card border border-border-subtle bg-surface-panel/80 p-6 shadow-sm sm:p-7"
			data-testid="session-energy-card"
		>
			<h2
				className="font-semibold text-primary text-xl"
				id="session-energy-heading"
			>
				{t("energyHeading")}
			</h2>
			<p className="mt-1.5 text-sm text-text-secondary">{t("energyBody")}</p>
			<EnergySelector
				disabled={disabled}
				onSelect={setSelected}
				selectedValue={selected}
			/>
			<p
				className="mt-4 flex items-start gap-2 rounded-control bg-surface-card-muted px-3 py-2.5 text-text-dimmed text-xs"
				data-testid="session-energy-hint"
			>
				<svg
					aria-hidden="true"
					className="mt-px h-4 w-4 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						cx="12"
						cy="12"
						r="9"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M12 11V16M12 8H12.01"
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth="1.5"
					/>
				</svg>
				<span>{t("energyHint")}</span>
			</p>
			<button
				className={`${overlayButtonClass.primary} mt-5 w-full py-2.5 text-sm`}
				data-testid="session-energy-continue-btn"
				disabled={disabled || selected == null}
				onClick={handleContinue}
				type="button"
			>
				{t("energyContinue")}
			</button>
			<button
				className={`${overlayButtonClass.secondary} mt-2 w-full py-2 text-sm text-text-dimmed hover:text-text-secondary`}
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
