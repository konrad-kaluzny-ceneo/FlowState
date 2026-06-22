"use client";

import { StyledCheckbox } from "~/app/_components/styled-checkbox";
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
			<StyledCheckbox
				checked={enabled}
				className="justify-center"
				data-testid="out-of-tab-break-alerts-toggle"
				disabled={disabled}
				label="Alert me when break starts (other tab)"
				onChange={handleToggle}
			/>
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
