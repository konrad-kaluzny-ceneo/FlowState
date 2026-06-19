import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";

export type BreakKind = "SHORT_BREAK" | "LONG_BREAK";

export type BreakOutOfTabAlertInput = {
	breakKind: BreakKind;
	isTabHidden: boolean;
	outOfTabEnabled: boolean;
	notificationPermission: NotificationPermission;
	cycleEndAudioMode: CycleEndAudioMode;
	cycleId: string;
};

export type BreakOutOfTabAlertResult = {
	playedNotification: boolean;
	shouldPlayBackgroundAudio: boolean;
};

export type ShowBreakStartNotificationOptions = {
	breakKind: BreakKind;
	cycleId: string;
	tag: string;
};
