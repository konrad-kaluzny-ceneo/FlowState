"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { requestNotificationPermission } from "~/lib/break-out-of-tab-alert/notify-break-start";

type BreakAlertsPermissionPromptProps = {
	visible: boolean;
	onEnable: () => void;
	onDismiss: () => void;
};

export function BreakAlertsPermissionPrompt({
	visible,
	onEnable,
	onDismiss,
}: BreakAlertsPermissionPromptProps) {
	if (!visible) {
		return null;
	}

	return (
		<OverlayScrim
			ariaDescribedBy="break-alerts-permission-description"
			ariaLabelledBy="break-alerts-permission-heading"
			role="dialog"
			testId="break-alerts-permission-prompt"
			zIndex={60}
		>
			<OverlayCard>
				<h2
					className="font-semibold text-primary text-xl"
					id="break-alerts-permission-heading"
				>
					Break alerts in other tabs
				</h2>
				<p
					className="mt-3 text-sm text-text-secondary"
					id="break-alerts-permission-description"
				>
					When you are in another tab, FlowState can send a calm notification
					and play your break chime when a break starts. You can turn this off
					anytime in break settings.
				</p>
				<div className="mt-6 flex flex-col gap-3">
					<button
						className={overlayButtonClass.primaryFull}
						data-testid="break-alerts-permission-enable-btn"
						onClick={() => {
							void (async () => {
								await requestNotificationPermission();
								onEnable();
							})();
						}}
						type="button"
					>
						Enable notifications
					</button>
					<button
						className={overlayButtonClass.secondaryFull}
						data-testid="break-alerts-permission-not-now-btn"
						onClick={onDismiss}
						type="button"
					>
						Not now
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
