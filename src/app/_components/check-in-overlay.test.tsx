import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckInOverlay } from "./check-in-overlay";

describe("CheckInOverlay", () => {
	it("renders blocking gate shell with energy selector", () => {
		render(
			<CheckInOverlay
				cycleId={42}
				onSubmit={vi.fn().mockResolvedValue(undefined)}
			/>,
		);

		expect(screen.getByTestId("check-in-overlay")).toBeTruthy();
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByText("How's your energy?")).toBeTruthy();
		expect(
			screen.getByText("Select one before your break starts."),
		).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-steady")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-focused")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-fading")).toBeTruthy();
	});

	it("calls onSubmit with selected energy", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		render(<CheckInOverlay cycleId={11} onSubmit={onSubmit} />);

		fireEvent.click(screen.getByTestId("check-in-energy-fading"));

		expect(onSubmit).toHaveBeenCalledWith("FADING");
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
});
