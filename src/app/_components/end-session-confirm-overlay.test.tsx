import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	END_SESSION_CONFIRM_BODY,
	END_SESSION_CONFIRM_CANCEL_LABEL,
	END_SESSION_CONFIRM_LABEL,
	END_SESSION_CONFIRM_TITLE,
} from "~/lib/session/end-session-copy";

import { EndSessionConfirmOverlay } from "./end-session-confirm-overlay";

describe("EndSessionConfirmOverlay", () => {
	it("renders confirm copy and action buttons", () => {
		render(<EndSessionConfirmOverlay onCancel={vi.fn()} onConfirm={vi.fn()} />);

		expect(screen.getByTestId("end-session-confirm-overlay")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: END_SESSION_CONFIRM_TITLE }),
		).toBeTruthy();
		expect(screen.getByText(END_SESSION_CONFIRM_BODY)).toBeTruthy();
		expect(screen.getByTestId("end-session-confirm-btn")).toBeTruthy();
		expect(screen.getByTestId("end-session-confirm-cancel-btn")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: END_SESSION_CONFIRM_LABEL }),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: END_SESSION_CONFIRM_CANCEL_LABEL }),
		).toBeTruthy();
	});

	it("calls onConfirm and onCancel from action buttons", () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		render(
			<EndSessionConfirmOverlay onCancel={onCancel} onConfirm={onConfirm} />,
		);

		fireEvent.click(screen.getByTestId("end-session-confirm-cancel-btn"));
		fireEvent.click(screen.getByTestId("end-session-confirm-btn"));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("disables actions while submitting", () => {
		render(
			<EndSessionConfirmOverlay
				isSubmitting
				onCancel={vi.fn()}
				onConfirm={vi.fn()}
			/>,
		);

		expect(screen.getByTestId("end-session-confirm-btn")).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByTestId("end-session-confirm-cancel-btn")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
