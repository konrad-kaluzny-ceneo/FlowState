import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomeHeroSprig } from "./home-hero-sprig";

describe("HomeHeroSprig", () => {
	it("forwards the required variant to the wrapper and both primitives", () => {
		render(<HomeHeroSprig variant="work" />);

		const hero = screen.getByTestId("home-hero-sprig");
		expect(hero.getAttribute("data-illustration-variant")).toBe("work");
		expect(hero.getAttribute("aria-hidden")).toBe("true");

		const primitives = hero.querySelectorAll(
			"svg[data-illustration-variant='work']",
		);
		expect(primitives.length).toBe(2);
	});

	it("applies the crossfade transition classes on the wrapper", () => {
		render(<HomeHeroSprig variant="idle" />);

		const className =
			screen.getByTestId("home-hero-sprig").getAttribute("class") ?? "";
		expect(className).toContain("transition-opacity");
		expect(className).toContain("duration-200");
		expect(className).toContain("motion-reduce:transition-none");
	});

	it("exposes the energy tint attribute only when a tint is provided", () => {
		const { rerender } = render(
			<HomeHeroSprig energyTint="FOCUSED" variant="work" />,
		);

		const hero = screen.getByTestId("home-hero-sprig");
		expect(hero.getAttribute("data-illustration-energy")).toBe("FOCUSED");

		rerender(<HomeHeroSprig energyTint={null} variant="break" />);
		expect(hero.getAttribute("data-illustration-energy")).toBeNull();
		expect(hero.getAttribute("data-illustration-variant")).toBe("break");
	});
});
