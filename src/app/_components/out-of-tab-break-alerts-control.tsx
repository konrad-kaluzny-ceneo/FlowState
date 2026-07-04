"use client";

import { useTranslations } from "next-intl";

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
	const t = useTranslations("BreakAlerts");
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
				label={t("settingsToggleLabel")}
				onChange={handleToggle}
			/>
			{permission === "denied" && (
				<div className="mt-2 text-center text-text-dimmed text-xs">
					<p>{t("permissionDeniedHint")}</p>
					<button
						className="mt-2 underline hover:text-text-secondary"
						data-testid="out-of-tab-break-alerts-retry"
						onClick={() => void requestNotificationPermission()}
						type="button"
					>
						{t("tryAgain")}
					</button>
				</div>
			)}
			{permission === "default" && enabled && (
				<p className="mt-2 text-center text-text-dimmed text-xs">
					{t("permissionDefaultHint")}
				</p>
			)}
		</fieldset>
	);
}
