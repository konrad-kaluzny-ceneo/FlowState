import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EnergySelector } from "./energy-selector";

describe("EnergySelector", () => {
	it("renders three energy buttons with stable test IDs", () => {
		render(<EnergySelector onSelect={vi.fn()} />);

		expect(screen.getByTestId("check-in-energy-focused")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-steady")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-fading")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Focused" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Steady" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Fading" })).toBeTruthy();
	});

	it("calls onSelect with the correct enum on click", () => {
		const onSelect = vi.fn();
		render(<EnergySelector onSelect={onSelect} />);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));
		expect(onSelect).toHaveBeenCalledWith("FOCUSED");

		fireEvent.click(screen.getByTestId("check-in-energy-steady"));
		expect(onSelect).toHaveBeenCalledWith("STEADY");

		fireEvent.click(screen.getByTestId("check-in-energy-fading"));
		expect(onSelect).toHaveBeenCalledWith("FADING");
	});

	it("blocks clicks when disabled", () => {
		const onSelect = vi.fn();
		render(<EnergySelector disabled onSelect={onSelect} />);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));

		expect(onSelect).not.toHaveBeenCalled();
		expect(screen.getByTestId("check-in-energy-focused")).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("renders optional coach line", () => {
		render(
			<EnergySelector
				coachLine="Pick the energy that fits right now."
				onSelect={vi.fn()}
			/>,
		);

		expect(screen.getByTestId("check-in-coach-line").textContent).toBe(
			"Pick the energy that fits right now.",
		);
	});

	it("exposes an accessible energy chip group", () => {
		render(<EnergySelector onSelect={vi.fn()} />);

		expect(screen.getByRole("group", { name: "Energy level" })).toBeTruthy();
	});
});
