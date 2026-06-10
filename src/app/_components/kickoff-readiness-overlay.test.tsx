import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KickoffReadinessOverlay } from "./kickoff-readiness-overlay";

describe("KickoffReadinessOverlay", () => {
	it("renders overlay with kickoff copy and skip button", () => {
		render(<KickoffReadinessOverlay onSkip={vi.fn()} onSubmit={vi.fn()} />);

		expect(screen.getByTestId("kickoff-readiness-overlay")).toBeTruthy();
		expect(screen.getByText("How's your energy to start?")).toBeTruthy();
		expect(
			screen.getByText("Pick one so we can suggest your first task."),
		).toBeTruthy();
		expect(screen.getByTestId("kickoff-readiness-skip-btn")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Skip — use Steady" }),
		).toBeTruthy();
	});

	it("calls onSubmit with selected energy", () => {
		const onSubmit = vi.fn();
		render(<KickoffReadinessOverlay onSkip={vi.fn()} onSubmit={onSubmit} />);

		fireEvent.click(screen.getByTestId("check-in-energy-fading"));

		expect(onSubmit).toHaveBeenCalledWith("FADING");
	});

	it("calls onSkip when skip button is clicked", () => {
		const onSkip = vi.fn();
		render(<KickoffReadinessOverlay onSkip={onSkip} onSubmit={vi.fn()} />);

		fireEvent.click(screen.getByTestId("kickoff-readiness-skip-btn"));

		expect(onSkip).toHaveBeenCalledTimes(1);
	});

	it("disables energy buttons and skip while submitting", () => {
		render(
			<KickoffReadinessOverlay
				isSubmitting
				onSkip={vi.fn()}
				onSubmit={vi.fn()}
			/>,
		);

		expect(screen.getByTestId("check-in-energy-focused")).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByTestId("kickoff-readiness-skip-btn")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
