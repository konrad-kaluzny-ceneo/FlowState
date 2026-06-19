"use client";

import {
	getNotificationPermission,
	requestNotificationPermission,
} from "~/lib/break-out-of-tab-alert/notify-break-start";

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

	return (
		<fieldset
			className="border-border-subtle border-t pt-4"
			data-testid="out-of-tab-break-alerts-control"
		>
			<legend className="mb-2 w-full text-center text-sm text-text-secondary">
				Out-of-tab break alerts
			</legend>
			<label className="flex items-center justify-center gap-2 text-sm text-text-secondary">
				<input
					checked={enabled}
					data-testid="out-of-tab-break-alerts-toggle"
					disabled={disabled}
					onChange={(event) => onChange(event.target.checked)}
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
			{permission === "default" && (
				<p className="mt-2 text-center text-text-dimmed text-xs">
					Enable notifications when prompted, or use browser settings later.
				</p>
			)}
		</fieldset>
	);
}
