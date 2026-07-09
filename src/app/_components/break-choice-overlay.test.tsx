import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BreakChoiceOverlay } from "./break-choice-overlay";

describe("BreakChoiceOverlay", () => {
	it("renders with short break suggested and star visible", () => {
		render(
			<BreakChoiceOverlay onChoose={vi.fn()} suggestedKind="SHORT_BREAK" />,
		);

		expect(screen.getByTestId("break-choice-overlay")).toBeTruthy();
		expect(screen.getByTestId("break-choice-short")).toBeTruthy();
		expect(screen.getByTestId("break-choice-long")).toBeTruthy();

		// Star on the short option
		const shortBtn = screen.getByTestId("break-choice-short");
		expect(shortBtn.textContent).toContain("★");

		// No star on long option
		const longBtn = screen.getByTestId("break-choice-long");
		expect(longBtn.textContent).not.toContain("★");
	});

	it("renders with long break suggested and star visible", () => {
		render(
			<BreakChoiceOverlay onChoose={vi.fn()} suggestedKind="LONG_BREAK" />,
		);

		const shortBtn = screen.getByTestId("break-choice-short");
		expect(shortBtn.textContent).not.toContain("★");

		const longBtn = screen.getByTestId("break-choice-long");
		expect(longBtn.textContent).toContain("★");
	});

	it("calls onChoose with SHORT_BREAK when short is clicked", () => {
		const onChoose = vi.fn();
		render(
			<BreakChoiceOverlay onChoose={onChoose} suggestedKind="SHORT_BREAK" />,
		);

		fireEvent.click(screen.getByTestId("break-choice-short"));
		expect(onChoose).toHaveBeenCalledWith("SHORT_BREAK");
	});

	it("calls onChoose with LONG_BREAK when long is clicked", () => {
		const onChoose = vi.fn();
		render(
			<BreakChoiceOverlay onChoose={onChoose} suggestedKind="SHORT_BREAK" />,
		);

		fireEvent.click(screen.getByTestId("break-choice-long"));
		expect(onChoose).toHaveBeenCalledWith("LONG_BREAK");
	});

	it("disables buttons when isSubmitting is true", () => {
		render(
			<BreakChoiceOverlay
				isSubmitting
				onChoose={vi.fn()}
				suggestedKind="SHORT_BREAK"
			/>,
		);

		expect(
			screen.getByTestId("break-choice-short").hasAttribute("disabled"),
		).toBe(true);
		expect(
			screen.getByTestId("break-choice-long").hasAttribute("disabled"),
		).toBe(true);
	});

	it("renders as a dialog with proper accessibility attributes", () => {
		render(
			<BreakChoiceOverlay onChoose={vi.fn()} suggestedKind="SHORT_BREAK" />,
		);

		const dialog = screen.getByRole("dialog");
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-labelledby")).toBe("break-choice-heading");
		expect(dialog.getAttribute("aria-describedby")).toBe(
			"break-choice-description",
		);
	});
});
