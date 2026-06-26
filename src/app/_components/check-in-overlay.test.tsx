import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckInOverlay } from "./check-in-overlay";

describe("CheckInOverlay", () => {
	it("renders labelled modal gate with energy selector", () => {
		render(
			<CheckInOverlay
				cycleId={42}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		const dialog = screen.getByRole("dialog", { name: "How's your energy?" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"check-in-description",
		);
		expect(screen.getByTestId("check-in-overlay")).toBeTruthy();
		expect(
			screen.getByText("Select one before your break starts."),
		).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-steady")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-focused")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-fading")).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByTestId("check-in-energy-focused"),
		);
	});

	it("calls onSubmit with selected energy", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<CheckInOverlay cycleId={11} onSubmit={onSubmit} />);

		fireEvent.click(screen.getByTestId("check-in-energy-fading"));

		expect(onSubmit).toHaveBeenCalledWith("FADING");
	});

	it("does not dismiss on Escape because energy choice is required", () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<CheckInOverlay cycleId={7} onSubmit={onSubmit} />);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("shows coach line when provided", () => {
		render(
			<CheckInOverlay
				coachLine="This quick check-in helps FlowState suggest what fits your energy."
				cycleId={7}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByTestId("check-in-coach-line")).toBeTruthy();
		expect(
			screen.getByText(
				"This quick check-in helps FlowState suggest what fits your energy.",
			),
		).toBeTruthy();
	});

	it("traps Tab focus within modal energy controls", () => {
		render(
			<CheckInOverlay
				cycleId={1}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		const focused = screen.getByTestId("check-in-energy-focused");
		const fading = screen.getByTestId("check-in-energy-fading");

		fading.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
		expect(document.activeElement).toBe(focused);
	});
});
