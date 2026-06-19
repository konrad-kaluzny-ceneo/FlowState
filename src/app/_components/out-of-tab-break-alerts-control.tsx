"use client";

import {
	getNotificationPermission,
	requestNotificationPermission,
} from "~/lib/break-out-of-tab-alert/notify-break-start";
import {
	resolveOutOfTabBreakAlertStatus,
	statusLabel,
} from "~/lib/break-out-of-tab-alert/preference-status";

type OutOfTabBreakAlertsControlProps = {
	enabled: boolean;
	onChange: (enabled: boolean) => void;
	disabled?: boolean;
};

export function OutOfTabBreakAlertsControl({
	enabled,
	onChange,
	disabled = false,
}: OutOfTabBreakAlertsControlProps) {
	const permission = getNotificationPermission();
	const status = resolveOutOfTabBreakAlertStatus({
		enabled,
		notificationPermission: permission,
	});

	const handleToggle = (next: boolean) => {
		if (!next) {
			onChange(false);
			return;
		}

		void (async () => {
			if (permission === "default") {
				await requestNotificationPermission();
			}
			onChange(true);
		})();
	};

	return (
		<fieldset
			className="border-border-subtle border-t pt-4"
			data-testid="out-of-tab-break-alerts-control"
		>
			<legend className="mb-2 w-full text-center text-sm text-text-secondary">
				Out-of-tab break alerts
			</legend>
			<p
				className="mb-3 text-center text-text-dimmed text-xs"
				data-testid="out-of-tab-break-alerts-status"
			>
				{statusLabel(status)}
			</p>
			<label className="flex items-center justify-center gap-2 text-sm text-text-secondary">
				<input
					checked={enabled}
					data-testid="out-of-tab-break-alerts-toggle"
					disabled={disabled}
					onChange={(event) => handleToggle(event.target.checked)}
					type="checkbox"
				/>
				Alert me when break starts (other tab)
			</label>
			{permission === "denied" && (
				<div className="mt-2 text-center text-text-dimmed text-xs">
					<p>
						Notifications are blocked in your browser. You can still get
						background audio when this is on.
					</p>
					<button
						className="mt-2 underline hover:text-text-secondary"
						data-testid="out-of-tab-break-alerts-retry"
						onClick={() => void requestNotificationPermission()}
						type="button"
					>
						Try again
					</button>
				</div>
			)}
			{permission === "default" && enabled && (
				<p className="mt-2 text-center text-text-dimmed text-xs">
					Browser permission is still needed — toggle off and on, or allow when
					prompted.
				</p>
			)}
		</fieldset>
	);
}
