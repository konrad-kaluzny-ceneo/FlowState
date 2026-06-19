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
	it("shows not-configured status when enabled without permission", () => {
		mockGetPermission.mockReturnValue("default");
		render(<OutOfTabBreakAlertsControl enabled onChange={vi.fn()} />);

		expect(
			screen.getByTestId("out-of-tab-break-alerts-status").textContent,
		).toContain("Not configured");
	});

	it("shows enabled status when permission granted", () => {
		mockGetPermission.mockReturnValue("granted");
		render(<OutOfTabBreakAlertsControl enabled onChange={vi.fn()} />);

		expect(
			screen.getByTestId("out-of-tab-break-alerts-status").textContent,
		).toContain("Enabled");
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
