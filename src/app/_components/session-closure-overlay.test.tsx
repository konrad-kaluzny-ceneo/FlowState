import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	CLOSURE_DISMISS_LABEL,
	CLOSURE_TITLE,
} from "~/lib/session/narrative-copy";

import { SessionClosureOverlay } from "./session-closure-overlay";

describe("SessionClosureOverlay", () => {
	it("renders labelled modal gate with closure line and dismiss action", () => {
		const onDismiss = vi.fn();

		render(
			<SessionClosureOverlay
				closureLine="Session complete — 2 cycles. Take a breath."
				onDismiss={onDismiss}
			/>,
		);

		const dialog = screen.getByRole("dialog", { name: CLOSURE_TITLE });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"session-closure-description",
		);
		expect(screen.getByTestId("session-closure-overlay")).toBeTruthy();
		expect(screen.getByTestId("session-closure-line").textContent).toBe(
			"Session complete — 2 cycles. Take a breath.",
		);
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: CLOSURE_DISMISS_LABEL }),
		);

		fireEvent.click(
			screen.getByRole("button", { name: CLOSURE_DISMISS_LABEL }),
		);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("dismisses on Escape using the existing acknowledgement path", () => {
		const onDismiss = vi.fn();
		render(
			<SessionClosureOverlay
				closureLine="Session complete."
				onDismiss={onDismiss}
			/>,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("restores focus to the trigger element on unmount", () => {
		const trigger = document.createElement("button");
		document.body.appendChild(trigger);
		trigger.focus();

		const { unmount } = render(
			<SessionClosureOverlay closureLine="Done." onDismiss={vi.fn()} />,
		);

		unmount();
		expect(document.activeElement).toBe(trigger);
		document.body.removeChild(trigger);
	});
});
