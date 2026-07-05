"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { StyledCheckbox } from "~/app/_components/styled-checkbox";
import {
	getNotificationPermission,
	requestNotificationPermission,
} from "~/lib/break-out-of-tab-alert/notify-break-start";

type OutOfTabBreakAlertsControlProps = {
	enabled: boolean;
	onChange: (enabled: boolean) => void;
	disabled?: boolean;
	variant?: "default" | "settings";
};

export function OutOfTabBreakAlertsControl({
	enabled,
	onChange,
	disabled = false,
	variant = "default",
}: OutOfTabBreakAlertsControlProps) {
	const t = useTranslations("BreakAlerts");
	const [permission, setPermission] = useState(getNotificationPermission);
	const deniedHintId = useId();
	const defaultHintId = useId();

	useEffect(() => {
		const syncPermission = () => {
			setPermission(getNotificationPermission());
		};

		syncPermission();
		document.addEventListener("visibilitychange", syncPermission);
		window.addEventListener("focus", syncPermission);

		return () => {
			document.removeEventListener("visibilitychange", syncPermission);
			window.removeEventListener("focus", syncPermission);
		};
	}, []);

	const permissionHintId =
		permission === "denied"
			? deniedHintId
			: permission === "default" && enabled
				? defaultHintId
				: undefined;

	const handleRetry = () => {
		void (async () => {
			const next = await requestNotificationPermission();
			setPermission(next);
		})();
	};

	const handleToggle = (next: boolean) => {
		if (!next) {
			onChange(false);
			return;
		}

		void (async () => {
			if (permission === "default") {
				const nextPermission = await requestNotificationPermission();
				setPermission(nextPermission);
			}
			onChange(true);
		})();
	};

	const isSettings = variant === "settings";

	return (
		<fieldset
			className={
				isSettings ? "border-0 p-0" : "border-border-subtle border-t pt-4"
			}
			data-testid="out-of-tab-break-alerts-control"
		>
			<StyledCheckbox
				ariaDescribedBy={permissionHintId}
				checked={enabled}
				className={isSettings ? "justify-start" : "justify-center"}
				data-testid="out-of-tab-break-alerts-toggle"
				disabled={disabled}
				label={t("settingsToggleLabel")}
				onChange={handleToggle}
			/>
			{permission === "denied" && (
				<div
					className={`mt-2 text-text-dimmed text-xs${isSettings ? "" : "text-center"}`}
					id={deniedHintId}
				>
					<p>{t("permissionDeniedHint")}</p>
					<button
						className="mt-2 underline hover:text-text-secondary"
						data-testid="out-of-tab-break-alerts-retry"
						onClick={handleRetry}
						type="button"
					>
						{t("tryAgain")}
					</button>
				</div>
			)}
			{permission === "default" && enabled && (
				<p
					className={`mt-2 text-text-dimmed text-xs${isSettings ? "" : "text-center"}`}
					id={defaultHintId}
				>
					{t("permissionDefaultHint")}
				</p>
			)}
		</fieldset>
	);
}
