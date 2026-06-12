"use client";

import {
	type CheckInEnergy,
	EnergySelector,
} from "~/app/_components/energy-selector";
import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";

type KickoffReadinessOverlayProps = {
	onSubmit: (energy: CheckInEnergy) => void;
	onSkip: () => void;
	isSubmitting?: boolean;
};

export function KickoffReadinessOverlay({
	onSubmit,
	onSkip,
	isSubmitting = false,
}: KickoffReadinessOverlayProps) {
	return (
		<OverlayScrim role="dialog" testId="kickoff-readiness-overlay" zIndex={60}>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">
					How&apos;s your energy to start?
				</h2>
				<p className="mt-2 text-sm text-text-secondary">
					Pick one so we can suggest your first task.
				</p>
				<EnergySelector disabled={isSubmitting} onSelect={onSubmit} />
				<button
					className={`${overlayButtonClass.secondaryFull} mt-4 py-2 text-sm text-text-dimmed hover:text-text-secondary`}
					data-testid="kickoff-readiness-skip-btn"
					disabled={isSubmitting}
					onClick={onSkip}
					type="button"
				>
					Skip — use Steady
				</button>
			</OverlayCard>
		</OverlayScrim>
	);
}
