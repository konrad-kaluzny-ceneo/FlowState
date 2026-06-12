import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_STORAGE_KEY } from "~/lib/design/theme";

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

function mockMatchMedia(matchesDark = false) {
	const listeners = new Set<(event: MediaQueryListEvent) => void>();
	const media = {
		matches: matchesDark,
		media: "(prefers-color-scheme: dark)",
		addEventListener: vi.fn(
			(_event: string, listener: (event: MediaQueryListEvent) => void) => {
				listeners.add(listener);
			},
		),
		removeEventListener: vi.fn(
			(_event: string, listener: (event: MediaQueryListEvent) => void) => {
				listeners.delete(listener);
			},
		),
	};

	window.matchMedia = vi.fn().mockReturnValue(media);
	return { media, listeners };
}

function renderUserMenu(userName = "Konrad") {
	return render(
		<ThemeProvider>
			<UserMenu userName={userName} />
		</ThemeProvider>,
	);
}

describe("UserMenu", () => {
	const originalLocation = window.location;

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		document.documentElement.dataset.theme = "light";
		mockMatchMedia(false);
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

	it("persists dark theme preference to localStorage and document", () => {
		renderUserMenu();

		fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(
			(screen.getByRole("radio", { name: "Dark" }) as HTMLInputElement).checked,
		).toBe(true);
	});

	it("updates theme preference when system is selected", () => {
		renderUserMenu();

		fireEvent.click(screen.getByRole("radio", { name: "System" }));

		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
		expect(["light", "dark"]).toContain(document.documentElement.dataset.theme);
		expect(
			(screen.getByRole("radio", { name: "System" }) as HTMLInputElement)
				.checked,
		).toBe(true);
	});

	it("follows OS preference changes while system mode is active", () => {
		const { media, listeners } = mockMatchMedia(false);
		renderUserMenu();

		fireEvent.click(screen.getByRole("radio", { name: "System" }));
		expect(document.documentElement.dataset.theme).toBe("light");

		media.matches = true;
		for (const listener of listeners) {
			listener({ matches: true } as MediaQueryListEvent);
		}

		expect(document.documentElement.dataset.theme).toBe("dark");
	});
});
