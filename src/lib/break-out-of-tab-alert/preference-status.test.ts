import { describe, expect, it } from "vitest";

import {
	resolveOutOfTabBreakAlertStatus,
	statusLabel,
} from "./preference-status";

describe("resolveOutOfTabBreakAlertStatus", () => {
	it("returns disabled when preference is off", () => {
		expect(
			resolveOutOfTabBreakAlertStatus({
				enabled: false,
				notificationPermission: "granted",
			}),
		).toBe("disabled");
	});

	it("returns enabled when preference on and permission granted", () => {
		expect(
			resolveOutOfTabBreakAlertStatus({
				enabled: true,
				notificationPermission: "granted",
			}),
		).toBe("enabled");
	});

	it("returns not-configured when preference on but permission not granted", () => {
		expect(
			resolveOutOfTabBreakAlertStatus({
				enabled: true,
				notificationPermission: "default",
			}),
		).toBe("not-configured");

		expect(
			resolveOutOfTabBreakAlertStatus({
				enabled: true,
				notificationPermission: "denied",
			}),
		).toBe("not-configured");
	});
});

describe("statusLabel", () => {
	it("labels each status", () => {
		expect(statusLabel("enabled")).toContain("Enabled");
		expect(statusLabel("disabled")).toContain("Disabled");
		expect(statusLabel("not-configured")).toContain("Not configured");
	});
});
