import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	WIND_DOWN_BODY,
	WIND_DOWN_END_SESSION_LABEL,
	WIND_DOWN_KEEP_GOING_LABEL,
	WIND_DOWN_TITLE,
} from "~/lib/session/wind-down-copy";

import { WindDownOverlay } from "./wind-down-overlay";

describe("WindDownOverlay", () => {
	it("renders labelled modal gate with fatigue rationale and primary actions", () => {
		render(
			<WindDownOverlay
				onEndSession={vi.fn()}
				onKeepGoing={vi.fn()}
				rationale="Your energy is dipping after 4 cycles — a good time to wrap up."
			/>,
		);

		const dialog = screen.getByRole("dialog", { name: WIND_DOWN_TITLE });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"wind-down-description",
		);
		expect(screen.getByTestId("wind-down-overlay")).toBeTruthy();
		expect(screen.getByText(WIND_DOWN_BODY)).toBeTruthy();
		expect(screen.getByTestId("wind-down-rationale")).toBeTruthy();
		expect(
			screen.getByText(
				"Your energy is dipping after 4 cycles — a good time to wrap up.",
			),
		).toBeTruthy();
		expect(screen.getByTestId("wind-down-keep-going-btn")).toBeTruthy();
		expect(screen.getByTestId("wind-down-end-session-btn")).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: WIND_DOWN_KEEP_GOING_LABEL }),
		);
	});

	it("calls onKeepGoing and onEndSession from primary buttons", () => {
		const onKeepGoing = vi.fn();
		const onEndSession = vi.fn();
		render(
			<WindDownOverlay
				onEndSession={onEndSession}
				onKeepGoing={onKeepGoing}
				rationale="Your session had several interruptions — ending now is a valid choice."
			/>,
		);

		fireEvent.click(screen.getByTestId("wind-down-keep-going-btn"));
		fireEvent.click(screen.getByTestId("wind-down-end-session-btn"));

		expect(onKeepGoing).toHaveBeenCalledTimes(1);
		expect(onEndSession).toHaveBeenCalledTimes(1);
	});

	it("does not bypass required choice on Escape", () => {
		const onKeepGoing = vi.fn();
		const onEndSession = vi.fn();
		render(
			<WindDownOverlay
				onEndSession={onEndSession}
				onKeepGoing={onKeepGoing}
				rationale="End-session nudge"
			/>,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onKeepGoing).not.toHaveBeenCalled();
		expect(onEndSession).not.toHaveBeenCalled();
	});

	it("disables actions while submitting", () => {
		render(
			<WindDownOverlay
				isSubmitting
				onEndSession={vi.fn()}
				onKeepGoing={vi.fn()}
				rationale="End-session nudge"
			/>,
		);

		expect(screen.getByTestId("wind-down-keep-going-btn")).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByTestId("wind-down-end-session-btn")).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("traps Tab focus within modal actions", () => {
		render(
			<WindDownOverlay
				onEndSession={vi.fn()}
				onKeepGoing={vi.fn()}
				rationale="End-session nudge"
			/>,
		);

		const keepGoing = screen.getByRole("button", {
			name: WIND_DOWN_KEEP_GOING_LABEL,
		});
		const endSession = screen.getByRole("button", {
			name: WIND_DOWN_END_SESSION_LABEL,
		});

		endSession.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
		expect(document.activeElement).toBe(keepGoing);
	});
});
