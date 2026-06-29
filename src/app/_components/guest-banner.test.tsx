import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GuestBanner } from "./guest-banner";

describe("GuestBanner", () => {
	it("renders guest banner with sign-in and sign-up links", () => {
		render(<GuestBanner />);

		expect(screen.getByTestId("guest-banner")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveProperty(
			"href",
			"http://localhost:3000/auth/sign-in",
		);
		expect(screen.getByRole("link", { name: "sign up" })).toHaveProperty(
			"href",
			"http://localhost:3000/auth/sign-up",
		);
	});

	it("hides header variant at lg breakpoint", () => {
		render(<GuestBanner variant="header" />);

		expect(screen.getByTestId("guest-banner").className).toContain("lg:hidden");
	});

	it("renders rail activation variant with full-width desktop class", () => {
		render(<GuestBanner variant="rail-activation" />);

		const block = screen.getByTestId("guest-rail-activation-hint");
		expect(block.className).toContain("lg:max-w-none");
		expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
	});
});
