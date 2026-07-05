import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionEnergyCard } from "./session-steering-card";

describe("SessionEnergyCard", () => {
	it("renders energy card with continue, skip and hint", () => {
		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={vi.fn()} />);

		expect(screen.getByTestId("session-energy-card")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-focused")).toBeTruthy();
		expect(screen.getByTestId("session-energy-continue-btn")).toBeTruthy();
		expect(screen.getByTestId("session-energy-skip-btn")).toBeTruthy();
		expect(screen.getByTestId("session-energy-hint")).toBeTruthy();
	});

	it("keeps continue disabled until an energy is picked", () => {
		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={vi.fn()} />);

		const continueBtn = screen.getByTestId(
			"session-energy-continue-btn",
		) as HTMLButtonElement;
		expect(continueBtn.disabled).toBe(true);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));

		expect(continueBtn.disabled).toBe(false);
	});

	it("does not fire onSelect on the energy pick alone (two-step)", () => {
		const onSelect = vi.fn();

		render(<SessionEnergyCard onSelect={onSelect} onSkip={vi.fn()} />);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("fires onSelect with the picked energy when Continue clicked", () => {
		const onSelect = vi.fn();

		render(<SessionEnergyCard onSelect={onSelect} onSkip={vi.fn()} />);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));
		fireEvent.click(screen.getByTestId("session-energy-continue-btn"));

		expect(onSelect).toHaveBeenCalledWith("FOCUSED");
	});

	it("fires onSkip when Skip clicked", () => {
		const onSkip = vi.fn();

		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={onSkip} />);

		fireEvent.click(screen.getByTestId("session-energy-skip-btn"));

		expect(onSkip).toHaveBeenCalled();
	});

	it("exposes a labelled energy steering region", () => {
		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={vi.fn()} />);

		expect(
			screen.getByRole("region", { name: "How's your energy today?" }),
		).toBeTruthy();
	});
});
