import type { NotificationPermission } from "./types";

export type OutOfTabBreakAlertStatus =
	| "enabled"
	| "disabled"
	| "not-configured";

export function resolveOutOfTabBreakAlertStatus(input: {
	enabled: boolean;
	notificationPermission: NotificationPermission;
}): OutOfTabBreakAlertStatus {
	if (!input.enabled) {
		return "disabled";
	}

	if (input.notificationPermission === "granted") {
		return "enabled";
	}

	return "not-configured";
}

export function statusLabel(status: OutOfTabBreakAlertStatus): string {
	switch (status) {
		case "enabled":
			return "Enabled — notifications on when break starts in another tab";
		case "disabled":
			return "Disabled — no out-of-tab break alerts";
		case "not-configured":
			return "Not configured — turn on below to allow browser notifications";
	}
}
