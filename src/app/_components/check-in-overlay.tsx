"use client";

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
	return (
		<OverlayScrim
			cycleId={cycleId}
			role="dialog"
			testId="check-in-overlay"
			zIndex={60}
		>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">
					How&apos;s your energy?
				</h2>
				<p className="mt-2 text-sm text-text-secondary">
					Select one before your break starts.
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
