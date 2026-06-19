import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BreakAlertsPermissionPrompt } from "./break-alerts-permission-prompt";

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
}));

describe("BreakAlertsPermissionPrompt", () => {
	it("calls onDismiss when Not now is clicked", () => {
		const onDismiss = vi.fn();
		render(
			<BreakAlertsPermissionPrompt
				onDismiss={onDismiss}
				onEnable={vi.fn()}
				visible
			/>,
		);

		fireEvent.click(screen.getByTestId("break-alerts-permission-not-now-btn"));

		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
