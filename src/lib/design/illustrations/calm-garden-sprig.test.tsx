import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalmGardenSprig } from "./calm-garden-sprig";

describe("CalmGardenSprig", () => {
	it("stamps the required variant on the root svg and stays decorative", () => {
		render(<CalmGardenSprig data-testid="sprig" variant="energy_choice" />);

		const sprig = screen.getByTestId("sprig");
		expect(sprig.getAttribute("data-illustration-variant")).toBe(
			"energy_choice",
		);
		expect(sprig.getAttribute("aria-hidden")).toBe("true");
	});

	it("applies a variant pose class alongside the crossfade classes", () => {
		render(<CalmGardenSprig data-testid="sprig" variant="return" />);

		const className = screen.getByTestId("sprig").getAttribute("class") ?? "";
		expect(className).toContain("-rotate-6");
		expect(className).toContain("duration-200");
		expect(className).toContain("motion-reduce:transition-none");
	});
});
