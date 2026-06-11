import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserMenu } from "./user-menu";

const { signOut } = vi.hoisted(() => ({
	signOut: vi.fn(),
}));

vi.mock("~/lib/auth/client", () => ({
	authClient: {
		signOut,
	},
}));

describe("UserMenu", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("renders user name and sign-out control", () => {
		render(<UserMenu userName="Konrad" />);

		expect(screen.getByText("Konrad")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
	});

	it("calls auth signOut when sign out is clicked", async () => {
		signOut.mockResolvedValue(undefined);
		const locationSpy = { href: "" };
		Object.defineProperty(window, "location", {
			configurable: true,
			value: locationSpy,
		});

		render(<UserMenu userName="Konrad" />);
		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledTimes(1);
		});
		expect(locationSpy.href).toBe("/auth/sign-in");
	});
});
