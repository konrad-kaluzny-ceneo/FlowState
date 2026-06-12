import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getFirstRunCopy } from "~/lib/onboarding/copy";
import { FirstRunOverlay } from "./first-run-overlay";

describe("FirstRunOverlay authenticated", () => {
	const copy = getFirstRunCopy("authenticated");

	it("renders auth wedge workflow copy", () => {
		render(
			<FirstRunOverlay mode="authenticated" onDismiss={vi.fn()} visible />,
		);

		expect(screen.getByTestId("first-run-overlay")).toBeTruthy();
		expect(screen.getByTestId("first-run-overlay").className).toContain(
			"bg-scrim",
		);
		expect(screen.getByTestId("first-run-dismiss-btn").className).toContain(
			"w-full",
		);
		expect(screen.getByTestId("first-run-dismiss-btn").className).toContain(
			"bg-accent-cta",
		);
		expect(screen.getByRole("heading", { name: copy.title })).toBeTruthy();
		expect(screen.getByText(copy.body)).toBeTruthy();
		expect(screen.getByTestId("first-run-dismiss-btn")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
	});

	it("calls onDismiss when Got it is clicked", () => {
		const onDismiss = vi.fn();
		render(
			<FirstRunOverlay mode="authenticated" onDismiss={onDismiss} visible />,
		);

		fireEvent.click(screen.getByTestId("first-run-dismiss-btn"));

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});

describe("FirstRunOverlay guest", () => {
	const copy = getFirstRunCopy("guest");

	it("renders guest welcome copy without wedge workflow title", () => {
		render(<FirstRunOverlay mode="guest" onDismiss={vi.fn()} visible />);

		expect(screen.getByTestId("first-run-overlay")).toBeTruthy();
		expect(
			screen.getByRole("heading", { name: "Welcome to FlowState" }),
		).toBeTruthy();
		expect(screen.getByText(copy.body)).toBeTruthy();
		expect(screen.queryByText(/Your wedge workflow/i)).toBeNull();
		expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
	});

	it("returns null when not visible", () => {
		render(
			<FirstRunOverlay mode="guest" onDismiss={vi.fn()} visible={false} />,
		);

		expect(screen.queryByTestId("first-run-overlay")).toBeNull();
	});
});
