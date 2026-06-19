import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OutOfTabBreakAlertsControl } from "./out-of-tab-break-alerts-control";

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	getNotificationPermission: vi.fn(() => "default"),
	requestNotificationPermission: vi.fn(),
}));

describe("OutOfTabBreakAlertsControl", () => {
	it("calls onChange when toggle is clicked", () => {
		const onChange = vi.fn();
		render(<OutOfTabBreakAlertsControl enabled onChange={onChange} />);

		fireEvent.click(screen.getByTestId("out-of-tab-break-alerts-toggle"));

		expect(onChange).toHaveBeenCalledWith(false);
	});
});
