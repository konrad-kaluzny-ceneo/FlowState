import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	CLOSURE_DISMISS_LABEL,
	CLOSURE_TITLE,
} from "~/lib/session/narrative-copy";

import { SessionClosureOverlay } from "./session-closure-overlay";

describe("SessionClosureOverlay", () => {
	it("renders closure line with dismiss action", () => {
		const onDismiss = vi.fn();

		render(
			<SessionClosureOverlay
				closureLine="Session complete — 2 cycles. Take a breath."
				onDismiss={onDismiss}
			/>,
		);

		expect(screen.getByTestId("session-closure-overlay")).toBeTruthy();
		expect(screen.getByRole("heading", { name: CLOSURE_TITLE })).toBeTruthy();
		expect(screen.getByTestId("session-closure-line").textContent).toBe(
			"Session complete — 2 cycles. Take a breath.",
		);

		fireEvent.click(
			screen.getByRole("button", { name: CLOSURE_DISMISS_LABEL }),
		);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});
