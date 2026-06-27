"use client";

import { useTranslations } from "next-intl";

import {
	type CheckInEnergy,
	type CheckInEnergyUi,
	EnergySelector,
} from "~/app/_components/energy-selector";
import { OverlayCard, OverlayScrim } from "~/app/_components/overlay-shell";

export type { CheckInEnergy, CheckInEnergyUi };

type CheckInOverlayProps = {
	cycleId: number;
	onSubmit: (energy: CheckInEnergy) => Promise<void>;
	isSubmitting?: boolean;
	coachLine?: string;
};

export function CheckInOverlay({
	cycleId,
	onSubmit,
	isSubmitting = false,
	coachLine,
}: CheckInOverlayProps) {
	const t = useTranslations("CheckIn");

	return (
		<OverlayScrim
			ariaDescribedBy="check-in-description"
			ariaLabelledBy="check-in-heading"
			cycleId={cycleId}
			role="dialog"
			testId="check-in-overlay"
			zIndex={60}
		>
			<OverlayCard>
				<h2
					className="font-semibold text-2xl text-primary"
					id="check-in-heading"
				>
					{t("heading")}
				</h2>
				<p
					className="mt-2 text-sm text-text-secondary"
					id="check-in-description"
				>
					{t("description")}
				</p>
				<EnergySelector
					coachLine={coachLine}
					disabled={isSubmitting}
					onSelect={(energy) => void onSubmit(energy)}
				/>
			</OverlayCard>
		</OverlayScrim>
	);
}
