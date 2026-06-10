"use client";

import {
	type CheckInEnergy,
	type CheckInEnergyUi,
	EnergySelector,
} from "~/app/_components/energy-selector";

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
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
			data-cycle-id={cycleId}
			data-testid="check-in-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">
					How&apos;s your energy?
				</h2>
				<p className="mt-2 text-sm text-white/60">
					Select one before your break starts.
				</p>
				<EnergySelector
					coachLine={coachLine}
					disabled={isSubmitting}
					onSelect={(energy) => void onSubmit(energy)}
				/>
			</div>
		</div>
	);
}
