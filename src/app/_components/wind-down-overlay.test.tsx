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
	it("renders fatigue rationale with primary actions", () => {
		render(
			<WindDownOverlay
				onEndSession={vi.fn()}
				onKeepGoing={vi.fn()}
				rationale="Your energy is dipping after 4 cycles — a good time to wrap up."
			/>,
		);

		expect(screen.getByTestId("wind-down-overlay")).toBeTruthy();
		expect(screen.getByRole("heading", { name: WIND_DOWN_TITLE })).toBeTruthy();
		expect(screen.getByText(WIND_DOWN_BODY)).toBeTruthy();
		expect(screen.getByTestId("wind-down-rationale")).toBeTruthy();
		expect(
			screen.getByText(
				"Your energy is dipping after 4 cycles — a good time to wrap up.",
			),
		).toBeTruthy();
		expect(screen.getByTestId("wind-down-keep-going-btn")).toBeTruthy();
		expect(screen.getByTestId("wind-down-end-session-btn")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: WIND_DOWN_KEEP_GOING_LABEL }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: WIND_DOWN_END_SESSION_LABEL }),
		).toBeTruthy();
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
});
