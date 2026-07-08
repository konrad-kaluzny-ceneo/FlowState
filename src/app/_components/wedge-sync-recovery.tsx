"use client";

import { useTranslations } from "next-intl";

import { overlayButtonClass } from "~/app/_components/overlay-shell";
import type { PendingWedgeRecovery } from "~/hooks/use-pomodoro-cycle";

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
	const t = useTranslations("WedgeSync");
	const tEnergy = useTranslations("Energy");

	function savedLocallyCopy(phase: PendingWedgeRecovery["phase"]): string {
		switch (phase) {
			case "check_in":
				return t("savedCheckIn");
			case "complete_work":
				return t("savedCompleteWork");
			case "start_break":
				return t("savedStartBreak");
			case "kickoff_session":
				return t("savedKickoffSession");
			case "kickoff_suggestion":
				return t("savedKickoffSuggestion");
		}
	}

	function energyLabel(energy: PendingWedgeRecovery["energy"]): string {
		switch (energy) {
			case "FOCUSED":
				return tEnergy("focused");
			case "STEADY":
				return tEnergy("steady");
			case "FADING":
				return tEnergy("fading");
		}
	}

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
				{t("heading")}
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
						{t("energyNote", { label: energyLabel(recovery.energy) })}
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
					{t("retry")}
				</button>
				<button
					className={`${overlayButtonClass.secondaryFull} py-2 font-medium`}
					onClick={onDismiss}
					type="button"
				>
					{t("dismiss")}
				</button>
			</div>
		</section>
	);
}
