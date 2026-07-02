import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalmGardenBlob } from "./calm-garden-blob";

describe("CalmGardenBlob", () => {
	it("stamps the required variant on the root svg and stays decorative", () => {
		render(<CalmGardenBlob data-testid="blob" variant="work" />);

		const blob = screen.getByTestId("blob");
		expect(blob.getAttribute("data-illustration-variant")).toBe("work");
		expect(blob.getAttribute("aria-hidden")).toBe("true");
	});

	it("applies a variant pose class alongside the crossfade classes", () => {
		render(<CalmGardenBlob data-testid="blob" variant="break" />);

		const className = screen.getByTestId("blob").getAttribute("class") ?? "";
		expect(className).toContain("opacity-80");
		expect(className).toContain("duration-200");
		expect(className).toContain("motion-reduce:transition-none");
	});
});
