"use client";

import { overlayButtonClass } from "~/app/_components/overlay-shell";
import type { PendingWedgeRecovery } from "~/hooks/use-pomodoro-cycle";

const ENERGY_LABEL: Record<PendingWedgeRecovery["energy"], string> = {
	FOCUSED: "Focused",
	STEADY: "Steady",
	FADING: "Fading",
};

function savedLocallyCopy(phase: PendingWedgeRecovery["phase"]): string {
	switch (phase) {
		case "check_in":
			return "Your work cycle is saved on this device.";
		case "complete_work":
			return "Your check-in is saved — we will finish the transition when you retry.";
		case "start_break":
			return "Your work cycle is saved.";
		case "suggestion_fetch":
			return "Your break is still running.";
	}
}

type WedgeSyncRecoveryProps = {
	recovery: PendingWedgeRecovery;
	onRetry: () => void;
	onDismiss: () => void;
	isRetrying?: boolean;
};

export function WedgeSyncRecovery({
	recovery,
	onRetry,
	onDismiss,
	isRetrying = false,
}: WedgeSyncRecoveryProps) {
	return (
		<div
			className="w-full rounded-lg border border-energy-steady-border bg-energy-steady-bg/80 px-4 py-3 text-sm text-text-secondary"
			data-testid="wedge-sync-recovery"
			role="alert"
		>
			<p className="font-medium text-primary">{recovery.message}</p>
			<p className="mt-1 text-text-dimmed">
				{savedLocallyCopy(recovery.phase)}
			</p>
			<p className="mt-1 text-text-dimmed">
				Energy: {ENERGY_LABEL[recovery.energy]} — no need to pick again.
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					className={`${overlayButtonClass.primaryFull} py-2 font-medium disabled:cursor-not-allowed`}
					disabled={isRetrying}
					onClick={onRetry}
					type="button"
				>
					Retry
				</button>
				<button
					className={`${overlayButtonClass.secondaryFull} py-2 font-medium`}
					onClick={onDismiss}
					type="button"
				>
					Dismiss
				</button>
			</div>
		</div>
	);
}
