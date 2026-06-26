import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BreakAlertsPermissionPrompt } from "./break-alerts-permission-prompt";

const mockRequestNotificationPermission = vi.fn().mockResolvedValue("granted");

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	requestNotificationPermission: (...args: unknown[]) =>
		mockRequestNotificationPermission(...args),
}));

describe("BreakAlertsPermissionPrompt", () => {
	it("renders labelled modal gate with initial focus on enable", () => {
		render(
			<BreakAlertsPermissionPrompt
				onDismiss={vi.fn()}
				onEnable={vi.fn()}
				visible
			/>,
		);

		const dialog = screen.getByRole("dialog", {
			name: "Break alerts in other tabs",
		});
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-labelledby")).toBe(
			"break-alerts-permission-heading",
		);
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"break-alerts-permission-description",
		);
		expect(screen.getByTestId("break-alerts-permission-prompt")).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "Enable notifications" }),
		);
	});

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

	it("traps Tab focus between enable and dismiss controls", () => {
		render(
			<BreakAlertsPermissionPrompt
				onDismiss={vi.fn()}
				onEnable={vi.fn()}
				visible
			/>,
		);

		const enable = screen.getByRole("button", { name: "Enable notifications" });
		const notNow = screen.getByRole("button", { name: "Not now" });

		expect(document.activeElement).toBe(enable);

		notNow.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
		expect(document.activeElement).toBe(enable);

		enable.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), {
			key: "Tab",
			shiftKey: true,
		});
		expect(document.activeElement).toBe(notNow);
	});

	it("requests permission then calls onEnable when enable is clicked", async () => {
		const onEnable = vi.fn();
		render(
			<BreakAlertsPermissionPrompt
				onDismiss={vi.fn()}
				onEnable={onEnable}
				visible
			/>,
		);

		fireEvent.click(screen.getByTestId("break-alerts-permission-enable-btn"));

		await waitFor(() => {
			expect(mockRequestNotificationPermission).toHaveBeenCalledOnce();
		});
		await waitFor(() => {
			expect(onEnable).toHaveBeenCalledOnce();
		});
	});

	it("is not rendered when visible is false", () => {
		render(
			<BreakAlertsPermissionPrompt
				onDismiss={vi.fn()}
				onEnable={vi.fn()}
				visible={false}
			/>,
		);

		expect(screen.queryByTestId("break-alerts-permission-prompt")).toBeNull();
	});
});
