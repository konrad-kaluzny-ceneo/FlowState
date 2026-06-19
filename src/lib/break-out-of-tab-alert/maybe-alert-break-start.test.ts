import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	maybeAlertBreakStart,
	resetBreakOutOfTabAlertDedupeForTests,
} from "./maybe-alert-break-start";
import {
	readNotificationPromptDismissed,
	readOutOfTabBreakAlertsEnabled,
	writeNotificationPromptDismissed,
	writeOutOfTabBreakAlertsEnabled,
} from "./storage";
import type { BreakOutOfTabAlertInput } from "./types";

const baseInput: BreakOutOfTabAlertInput = {
	breakKind: "SHORT_BREAK",
	isTabHidden: true,
	outOfTabEnabled: true,
	notificationPermission: "granted",
	cycleEndAudioMode: "normal",
	cycleId: "cycle-1",
};

describe("maybeAlertBreakStart", () => {
	beforeEach(() => {
		resetBreakOutOfTabAlertDedupeForTests();
	});

	it("no-ops when tab is visible", () => {
		const showNotification = vi.fn();
		const result = maybeAlertBreakStart(
			{ ...baseInput, isTabHidden: false },
			{ showNotification },
		);

		expect(result).toEqual({
			playedNotification: false,
			shouldPlayBackgroundAudio: false,
		});
		expect(showNotification).not.toHaveBeenCalled();
	});

	it("no-ops when out-of-tab toggle is off", () => {
		const showNotification = vi.fn();
		const result = maybeAlertBreakStart(
			{ ...baseInput, outOfTabEnabled: false },
			{ showNotification },
		);

		expect(result).toEqual({
			playedNotification: false,
			shouldPlayBackgroundAudio: false,
		});
		expect(showNotification).not.toHaveBeenCalled();
	});

	it("shows one notification when hidden, enabled, and permission granted", () => {
		const showNotification = vi.fn().mockReturnValue({ close: vi.fn() });
		const result = maybeAlertBreakStart(baseInput, { showNotification });

		expect(result).toEqual({
			playedNotification: true,
			shouldPlayBackgroundAudio: true,
		});
		expect(showNotification).toHaveBeenCalledOnce();
	});

	it("skips notification when permission denied but still allows background audio", () => {
		const showNotification = vi.fn();
		const result = maybeAlertBreakStart(
			{ ...baseInput, notificationPermission: "denied" },
			{ showNotification },
		);

		expect(result).toEqual({
			playedNotification: false,
			shouldPlayBackgroundAudio: true,
		});
		expect(showNotification).not.toHaveBeenCalled();
	});

	it("suppresses background audio when cycle audio is muted", () => {
		const showNotification = vi.fn().mockReturnValue({ close: vi.fn() });
		const result = maybeAlertBreakStart(
			{ ...baseInput, cycleEndAudioMode: "muted" },
			{ showNotification },
		);

		expect(result).toEqual({
			playedNotification: true,
			shouldPlayBackgroundAudio: false,
		});
	});

	it("dedupes notifications for the same cycle id", () => {
		const showNotification = vi.fn().mockReturnValue({ close: vi.fn() });

		maybeAlertBreakStart(baseInput, { showNotification });
		maybeAlertBreakStart(baseInput, { showNotification });

		expect(showNotification).toHaveBeenCalledOnce();
	});
});

describe("break-out-of-tab-alert storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults out-of-tab alerts to enabled", () => {
		expect(readOutOfTabBreakAlertsEnabled({ mode: "guest" })).toBe(true);
	});

	it("persists enabled flag per guest scope", () => {
		writeOutOfTabBreakAlertsEnabled({ mode: "guest" }, false);
		expect(readOutOfTabBreakAlertsEnabled({ mode: "guest" })).toBe(false);
	});

	it("isolates guest and authenticated scopes", () => {
		writeOutOfTabBreakAlertsEnabled({ mode: "guest" }, false);
		writeOutOfTabBreakAlertsEnabled(
			{ mode: "authenticated", userId: "user-1" },
			true,
		);

		expect(readOutOfTabBreakAlertsEnabled({ mode: "guest" })).toBe(false);
		expect(
			readOutOfTabBreakAlertsEnabled({
				mode: "authenticated",
				userId: "user-1",
			}),
		).toBe(true);
	});

	it("tracks notification prompt dismissal per scope", () => {
		expect(readNotificationPromptDismissed({ mode: "guest" })).toBe(false);
		writeNotificationPromptDismissed({ mode: "guest" }, true);
		expect(readNotificationPromptDismissed({ mode: "guest" })).toBe(true);
	});
});
