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
});
