import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComingSoonPreview } from "./coming-soon-preview";

describe("ComingSoonPreview", () => {
	it("renders the label as readable text", () => {
		render(
			<ComingSoonPreview label="Calendar coming soon">
				<p>Mock calendar content</p>
			</ComingSoonPreview>,
		);

		expect(screen.getByText("Calendar coming soon")).toBeTruthy();
		expect(screen.getByTestId("coming-soon-preview-label")).toBeTruthy();
	});

	it("marks the mock content as aria-hidden", () => {
		render(
			<ComingSoonPreview label="Coming soon">
				<p>Decorative mock</p>
			</ComingSoonPreview>,
		);

		const mock = screen.getByTestId("coming-soon-preview-mock");
		expect(mock.getAttribute("aria-hidden")).toBe("true");
		expect(mock.textContent).toContain("Decorative mock");
	});
});
