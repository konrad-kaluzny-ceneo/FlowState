import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionEnergyCard, SessionFocusCard } from "./session-steering-card";

describe("SessionEnergyCard", () => {
	it("renders energy card with skip", () => {
		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={vi.fn()} />);

		expect(screen.getByTestId("session-energy-card")).toBeTruthy();
		expect(screen.getByTestId("check-in-energy-focused")).toBeTruthy();
		expect(screen.getByTestId("session-energy-skip-btn")).toBeTruthy();
	});

	it("fires onSelect when energy chosen", () => {
		const onSelect = vi.fn();

		render(<SessionEnergyCard onSelect={onSelect} onSkip={vi.fn()} />);

		fireEvent.click(screen.getByTestId("check-in-energy-focused"));

		expect(onSelect).toHaveBeenCalledWith("FOCUSED");
	});

	it("fires onSkip when Skip clicked", () => {
		const onSkip = vi.fn();

		render(<SessionEnergyCard onSelect={vi.fn()} onSkip={onSkip} />);

		fireEvent.click(screen.getByTestId("session-energy-skip-btn"));

		expect(onSkip).toHaveBeenCalled();
	});
});

describe("SessionFocusCard", () => {
	it("renders focus card with intention controls", () => {
		render(<SessionFocusCard onComplete={vi.fn()} onSkip={vi.fn()} />);

		expect(screen.getByTestId("session-focus-card")).toBeTruthy();
		expect(screen.getByTestId("steering-intention-deep-work")).toBeTruthy();
		expect(screen.getByTestId("session-focus-skip-btn")).toBeTruthy();
	});

	it("fires onComplete with chip label on intention select", () => {
		const onComplete = vi.fn();

		render(<SessionFocusCard onComplete={onComplete} onSkip={vi.fn()} />);

		fireEvent.click(screen.getByTestId("steering-intention-deep-work"));

		expect(onComplete).toHaveBeenCalledWith("Deep work");
	});

	it("fires onSkip when Skip clicked", () => {
		const onSkip = vi.fn();

		render(<SessionFocusCard onComplete={vi.fn()} onSkip={onSkip} />);

		fireEvent.click(screen.getByTestId("session-focus-skip-btn"));

		expect(onSkip).toHaveBeenCalled();
	});
});
