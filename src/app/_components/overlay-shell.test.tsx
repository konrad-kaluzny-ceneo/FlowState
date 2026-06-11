import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OverlayCard, OverlayScrim } from "./overlay-shell";

describe("overlay-shell", () => {
	it("renders scrim with test id and dialog role", () => {
		render(
			<OverlayScrim role="dialog" testId="test-overlay">
				<span>content</span>
			</OverlayScrim>,
		);

		expect(screen.getByTestId("test-overlay")).toBeTruthy();
		expect(screen.getByRole("dialog")).toBeTruthy();
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
