import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";

import { AppNavbar } from "./app-navbar";
import { ThemeProvider } from "./theme-provider";

vi.mock("~/lib/auth/client", () => ({
	authClient: {
		signOut: vi.fn(),
	},
}));

vi.mock("~/hooks/use-language-preference", () => ({
	useLanguagePreference: () => ({
		locale: "en",
		setLocale: vi.fn(),
		isPending: false,
		persistError: null,
		isHydrated: true,
	}),
}));

function mockMatchMedia() {
	window.matchMedia = vi.fn().mockReturnValue({
		matches: false,
		media: "(prefers-color-scheme: dark)",
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
}

function renderNavbar(userName: string | null) {
	const scope =
		userName == null
			? ({ mode: "guest" } as const)
			: ({ mode: "authenticated", userId: "user-1" } as const);

	return render(
		<NextIntlClientProvider locale="en" messages={messages}>
			<ThemeProvider>
				<AppNavbar scope={scope} userName={userName} />
			</ThemeProvider>
		</NextIntlClientProvider>,
	);
}

describe("AppNavbar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		document.documentElement.dataset.theme = "light";
		mockMatchMedia();
	});

	it("renders the brand as a link to home", () => {
		renderNavbar(null);

		const brand = screen.getByRole("link", { name: "FlowState" });
		expect(brand.getAttribute("href")).toBe("/");
	});

	it("occupies layout flow instead of fixed positioning", () => {
		renderNavbar(null);

		const navbar = screen.getByTestId("app-navbar");
		expect(navbar.className).not.toContain("fixed");
		expect(navbar.className).not.toContain("sticky");
		expect(navbar.className).toContain("w-full");
	});

	it("shows preference controls without account actions for guests", () => {
		renderNavbar(null);

		expect(screen.getByTestId("language-switch")).toBeTruthy();
		expect(screen.getByTestId("theme-toggle")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
	});

	it("shows user name and sign-out for authenticated users", () => {
		renderNavbar("Konrad");

		expect(screen.getByText("Konrad")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
		expect(screen.getByTestId("language-switch")).toBeTruthy();
	});
});
