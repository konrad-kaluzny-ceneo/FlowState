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
		case "kickoff_session":
			return "Your session has not started yet.";
		case "kickoff_suggestion":
			return "Your session is ready — we will load a suggestion when you retry.";
	}
}

const WEDGE_SYNC_RECOVERY_HEADING_ID = "wedge-sync-recovery-heading";

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
		<section
			aria-labelledby={WEDGE_SYNC_RECOVERY_HEADING_ID}
			className="w-full rounded-lg border border-energy-steady-border bg-energy-steady-bg/80 px-4 py-3 text-sm text-text-secondary"
			data-testid="wedge-sync-recovery"
		>
			<h2
				className="font-semibold text-primary text-sm"
				id={WEDGE_SYNC_RECOVERY_HEADING_ID}
			>
				Sync recovery
			</h2>
			<div
				aria-atomic="true"
				aria-live="polite"
				className="mt-1"
				data-testid="wedge-sync-recovery-live-status"
			>
				<p className="font-medium text-primary">{recovery.message}</p>
				<p className="mt-1 text-text-dimmed">
					{savedLocallyCopy(recovery.phase)}
				</p>
				{recovery.phase !== "kickoff_session" && (
					<p className="mt-1 text-text-dimmed">
						Energy: {ENERGY_LABEL[recovery.energy]} — no need to pick again.
					</p>
				)}
			</div>
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
		</section>
	);
}
