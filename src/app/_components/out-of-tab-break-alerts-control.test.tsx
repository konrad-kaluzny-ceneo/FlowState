import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutOfTabBreakAlertsControl } from "./out-of-tab-break-alerts-control";

const mockGetPermission = vi.fn(() => "default" as NotificationPermission);
const mockRequestPermission = vi.fn(
	async () => "granted" as NotificationPermission,
);

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	getNotificationPermission: () => mockGetPermission(),
	requestNotificationPermission: () => mockRequestPermission(),
}));

describe("OutOfTabBreakAlertsControl", () => {
	it("does not show always-visible status label when permission granted", () => {
		mockGetPermission.mockReturnValue("granted");
		render(<OutOfTabBreakAlertsControl enabled onChange={vi.fn()} />);

		expect(screen.queryByTestId("out-of-tab-break-alerts-status")).toBeNull();
		expect(
			screen.getByText("Alert me when break starts (other tab)"),
		).toBeTruthy();
	});

	it("shows permission hint when enabled with default permission", () => {
		mockGetPermission.mockReturnValue("default");
		render(<OutOfTabBreakAlertsControl enabled onChange={vi.fn()} />);

		expect(screen.queryByTestId("out-of-tab-break-alerts-status")).toBeNull();
		expect(screen.getByText(/Browser permission is still needed/)).toBeTruthy();
	});

	it("shows denied guidance when notifications are blocked", () => {
		mockGetPermission.mockReturnValue("denied");
		render(<OutOfTabBreakAlertsControl enabled onChange={vi.fn()} />);

		expect(
			screen.getByText(/Notifications are blocked in your browser/),
		).toBeTruthy();
		expect(screen.getByTestId("out-of-tab-break-alerts-retry")).toBeTruthy();
	});

	it("calls onChange false when toggle off", () => {
		mockGetPermission.mockReturnValue("granted");
		const onChange = vi.fn();
		render(<OutOfTabBreakAlertsControl enabled onChange={onChange} />);

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-toggle"));

		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("requests permission when enabling with default permission", async () => {
		mockGetPermission.mockReturnValue("default");
		mockRequestPermission.mockClear();
		const onChange = vi.fn();
		render(<OutOfTabBreakAlertsControl enabled={false} onChange={onChange} />);

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-toggle"));

		await waitFor(() => {
			expect(mockRequestPermission).toHaveBeenCalled();
			expect(onChange).toHaveBeenCalledWith(true);
		});
	});
});
