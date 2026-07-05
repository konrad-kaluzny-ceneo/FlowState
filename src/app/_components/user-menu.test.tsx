import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

import { ThemeProvider } from "./theme-provider";
import { UserMenu } from "./user-menu";

const { signOut } = vi.hoisted(() => ({
	signOut: vi.fn(),
}));

vi.mock("~/lib/auth/client", () => ({
	authClient: {
		signOut,
	},
}));

function mockMatchMedia() {
	window.matchMedia = vi.fn().mockReturnValue({
		matches: false,
		media: "(prefers-color-scheme: dark)",
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
}

function renderUserMenu(userName = "Konrad") {
	return render(
		<NextIntlClientProvider locale="en" messages={messages}>
			<ThemeProvider>
				<UserMenu
					scope={{ mode: "authenticated", userId: "user-1" }}
					userName={userName}
				/>
			</ThemeProvider>
		</NextIntlClientProvider>,
	);
}

describe("UserMenu", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		document.documentElement.dataset.theme = "light";
		mockMatchMedia();
	});

	afterEach(() => {
		Object.defineProperty(window, "location", {
			configurable: true,
			value: originalLocation,
		});
	});

	it("renders user name and sign-out control", () => {
		renderUserMenu();

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

		renderUserMenu();
		fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(signOut).toHaveBeenCalledTimes(1);
		});
		expect(locationSpy.href).toBe("/auth/sign-in");
	});

	it("no longer renders theme or language controls (moved to Settings)", () => {
		renderUserMenu();

		expect(screen.queryByTestId("language-switch")).toBeNull();
		expect(screen.queryByTestId("theme-toggle")).toBeNull();
	});
});
