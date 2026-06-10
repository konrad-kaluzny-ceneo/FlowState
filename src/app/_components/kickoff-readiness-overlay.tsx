"use client";

import {
	type CheckInEnergy,
	EnergySelector,
} from "~/app/_components/energy-selector";

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
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
			data-testid="kickoff-readiness-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">
					How&apos;s your energy to start?
				</h2>
				<p className="mt-2 text-sm text-white/60">
					Pick one so we can suggest your first task.
				</p>
				<EnergySelector disabled={isSubmitting} onSelect={onSubmit} />
				<button
					className="mt-4 w-full rounded-lg border border-white/10 bg-transparent py-2 text-sm text-white/50 transition hover:border-white/20 hover:text-white/70 disabled:opacity-50"
					data-testid="kickoff-readiness-skip-btn"
					disabled={isSubmitting}
					onClick={onSkip}
					type="button"
				>
					Skip — use Steady
				</button>
			</div>
		</div>
	);
}
