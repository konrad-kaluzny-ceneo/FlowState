import type { ShowBreakStartNotificationOptions } from "./types";

const NOTIFICATION_TITLE = "Break time";

function breakBody(breakKind: ShowBreakStartNotificationOptions["breakKind"]) {
	if (breakKind === "LONG_BREAK") {
		return "Long break started — stretch, hydrate, and step away for a few minutes.";
	}

	return "Short break started — stand up, breathe, and grab some water.";
}

export function getNotificationPermission(): NotificationPermission {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return "denied";
	}

	return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return "denied";
	}

	if (Notification.permission === "granted") {
		return "granted";
	}

	if (Notification.permission === "denied") {
		return "denied";
	}

	return Notification.requestPermission();
}

export function showBreakStartNotification(
	options: ShowBreakStartNotificationOptions,
): Notification | null {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return null;
	}

	if (Notification.permission !== "granted") {
		return null;
	}

	try {
		const notification = new Notification(NOTIFICATION_TITLE, {
			body: breakBody(options.breakKind),
			tag: options.tag,
			requireInteraction: false,
		});

		notification.onclick = () => {
			window.focus();
			notification.close();
		};

		return notification;
	} catch {
		return null;
	}
}
