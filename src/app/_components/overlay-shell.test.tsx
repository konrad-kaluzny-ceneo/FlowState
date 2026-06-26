import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OverlayCard, OverlayScrim } from "./overlay-shell";

describe("overlay-shell", () => {
	it("renders presentation scrim without modal semantics", () => {
		const { container } = render(
			<OverlayScrim testId="test-overlay">
				<span>content</span>
			</OverlayScrim>,
		);

		const scrim = screen.getByTestId("test-overlay");
		expect(scrim.getAttribute("role")).toBe("presentation");
		expect(scrim.getAttribute("aria-modal")).toBeNull();
		expect(container.querySelector(".bg-scrim")).toBeTruthy();
	});

	it("renders labelled modal dialog with aria-modal and description wiring", () => {
		render(
			<OverlayScrim
				ariaDescribedBy="test-description"
				ariaLabelledBy="test-heading"
				role="dialog"
				testId="test-overlay"
			>
				<h2 id="test-heading">Gate title</h2>
				<p id="test-description">Gate description</p>
			</OverlayScrim>,
		);

		const dialog = screen.getByRole("dialog", { name: "Gate title" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(dialog.getAttribute("aria-labelledby")).toBe("test-heading");
		expect(dialog.getAttribute("aria-describedby")).toBe("test-description");
	});

	it("moves initial focus to the first interactive control in modal gates", () => {
		render(
			<OverlayScrim
				ariaLabelledBy="test-heading"
				role="dialog"
				testId="test-overlay"
			>
				<h2 id="test-heading">Gate title</h2>
				<button type="button">Primary</button>
				<button type="button">Secondary</button>
			</OverlayScrim>,
		);

		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: "Primary" }),
		);
	});

	it("traps Tab focus within modal gate controls", () => {
		render(
			<OverlayScrim
				ariaLabelledBy="test-heading"
				role="dialog"
				testId="test-overlay"
			>
				<h2 id="test-heading">Gate title</h2>
				<button type="button">Primary</button>
				<button type="button">Secondary</button>
			</OverlayScrim>,
		);

		const primary = screen.getByRole("button", { name: "Primary" });
		const secondary = screen.getByRole("button", { name: "Secondary" });

		secondary.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
		expect(document.activeElement).toBe(primary);

		primary.focus();
		fireEvent.keyDown(screen.getByRole("dialog"), {
			key: "Tab",
			shiftKey: true,
		});
		expect(document.activeElement).toBe(secondary);
	});

	it("calls onEscape for modal gates when Escape is pressed", () => {
		const onEscape = vi.fn();
		render(
			<OverlayScrim
				ariaLabelledBy="test-heading"
				onEscape={onEscape}
				role="dialog"
				testId="test-overlay"
			>
				<h2 id="test-heading">Gate title</h2>
				<button type="button">Primary</button>
			</OverlayScrim>,
		);

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		expect(onEscape).toHaveBeenCalledTimes(1);
	});

	it("restores focus to the previously focused element on unmount", () => {
		const trigger = document.createElement("button");
		document.body.appendChild(trigger);
		trigger.focus();

		const { unmount } = render(
			<OverlayScrim
				ariaLabelledBy="test-heading"
				role="dialog"
				testId="test-overlay"
			>
				<h2 id="test-heading">Gate title</h2>
				<button type="button">Primary</button>
			</OverlayScrim>,
		);

		unmount();
		expect(document.activeElement).toBe(trigger);
		document.body.removeChild(trigger);
	});

	it("renders card variants with design tokens", () => {
		const { container } = render(
			<OverlayCard variant="break">
				<h2>Break</h2>
			</OverlayCard>,
		);

		expect(screen.getByText("Break")).toBeTruthy();
		expect(container.querySelector(".bg-surface-break")).toBeTruthy();
	});
});
