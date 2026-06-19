import { showBreakStartNotification } from "./notify-break-start";
import type {
	BreakOutOfTabAlertInput,
	BreakOutOfTabAlertResult,
	ShowBreakStartNotificationOptions,
} from "./types";

let lastNotifiedCycleId: string | null = null;

export function resetBreakOutOfTabAlertDedupeForTests(): void {
	lastNotifiedCycleId = null;
}

type MaybeAlertBreakStartDeps = {
	showNotification?: (
		options: ShowBreakStartNotificationOptions,
	) => Notification | null;
};

export function maybeAlertBreakStart(
	input: BreakOutOfTabAlertInput,
	deps: MaybeAlertBreakStartDeps = {},
): BreakOutOfTabAlertResult {
	const showNotification = deps.showNotification ?? showBreakStartNotification;

	const noOp: BreakOutOfTabAlertResult = {
		playedNotification: false,
		shouldPlayBackgroundAudio: false,
	};

	if (!input.isTabHidden || !input.outOfTabEnabled) {
		return noOp;
	}

	if (input.cycleId === lastNotifiedCycleId) {
		return noOp;
	}

	const shouldPlayBackgroundAudio = input.cycleEndAudioMode !== "muted";

	if (input.notificationPermission !== "granted") {
		lastNotifiedCycleId = input.cycleId;
		return {
			playedNotification: false,
			shouldPlayBackgroundAudio,
		};
	}

	const notification = showNotification({
		breakKind: input.breakKind,
		cycleId: input.cycleId,
		tag: `flowstate-break-start-${input.cycleId}`,
	});

	if (notification) {
		lastNotifiedCycleId = input.cycleId;
	}

	return {
		playedNotification: notification != null,
		shouldPlayBackgroundAudio,
	};
}
