import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { IntlTestWrapper } from "~/i18n/test-intl";
import messages from "../../../messages/en.json";

import { OutOfTabBreakAlertsControl } from "./out-of-tab-break-alerts-control";

const mockGetPermission = vi.fn(() => "default" as NotificationPermission);
const mockRequestPermission = vi.fn(
	async () => "granted" as NotificationPermission,
);

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	getNotificationPermission: () => mockGetPermission(),
	requestNotificationPermission: () => mockRequestPermission(),
}));

function renderControl(
	props: ComponentProps<typeof OutOfTabBreakAlertsControl>,
) {
	return render(
		<IntlTestWrapper>
			<OutOfTabBreakAlertsControl {...props} />
		</IntlTestWrapper>,
	);
}

describe("OutOfTabBreakAlertsControl", () => {
	it("does not show always-visible status label when permission granted", () => {
		mockGetPermission.mockReturnValue("granted");
		renderControl({ enabled: true, onChange: vi.fn() });

		expect(screen.queryByTestId("out-of-tab-break-alerts-status")).toBeNull();
		expect(
			screen.getByText(messages.BreakAlerts.settingsToggleLabel),
		).toBeTruthy();
	});

	it("shows permission hint when enabled with default permission", () => {
		mockGetPermission.mockReturnValue("default");
		renderControl({ enabled: true, onChange: vi.fn() });

		expect(screen.queryByTestId("out-of-tab-break-alerts-status")).toBeNull();
		expect(
			screen.getByText(messages.BreakAlerts.permissionDefaultHint),
		).toBeTruthy();
	});

	it("shows denied guidance when notifications are blocked", () => {
		mockGetPermission.mockReturnValue("denied");
		renderControl({ enabled: true, onChange: vi.fn() });

		expect(
			screen.getByText(messages.BreakAlerts.permissionDeniedHint),
		).toBeTruthy();
		expect(screen.getByTestId("out-of-tab-break-alerts-retry")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: messages.BreakAlerts.tryAgain }),
		).toBeTruthy();
	});

	it("calls onChange false when toggle off", () => {
		mockGetPermission.mockReturnValue("granted");
		const onChange = vi.fn();
		renderControl({ enabled: true, onChange });

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-toggle"));

		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("requests permission when enabling with default permission", async () => {
		mockGetPermission.mockReturnValue("default");
		mockRequestPermission.mockClear();
		const onChange = vi.fn();
		renderControl({ enabled: false, onChange });

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-toggle"));

		await waitFor(() => {
			expect(mockRequestPermission).toHaveBeenCalled();
			expect(onChange).toHaveBeenCalledWith(true);
		});
	});

	it("associates permission hint with toggle via aria-describedby", () => {
		mockGetPermission.mockReturnValue("denied");
		renderControl({ enabled: true, onChange: vi.fn() });

		const toggle = screen.getByTestId(
			"out-of-tab-break-alerts-toggle",
		) as HTMLInputElement;
		const hint = screen
			.getByText(messages.BreakAlerts.permissionDeniedHint)
			.closest("div[id]");

		expect(toggle.getAttribute("aria-describedby")).toBe(hint?.id);
	});

	it("refreshes permission hint after retry", async () => {
		mockGetPermission.mockReturnValue("denied");
		mockRequestPermission.mockResolvedValue("granted");
		renderControl({ enabled: true, onChange: vi.fn() });

		expect(
			screen.getByText(messages.BreakAlerts.permissionDeniedHint),
		).toBeTruthy();

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-retry"));

		await waitFor(() => {
			expect(
				screen.queryByText(messages.BreakAlerts.permissionDeniedHint),
			).toBeNull();
		});
	});
});
