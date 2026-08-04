import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "~/app/_components/app-shell";

vi.mock("next/navigation", () => ({
	usePathname: () => "/focus",
}));

describe("AppShell guest sign-in", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows a Sign in link in the left sidebar for guests", () => {
		render(
			<AppShell scope={{ mode: "guest" }} userName={null}>
				<div>content</div>
			</AppShell>,
		);

		const sidebar = screen.getByTestId("app-sidebar");
		const signIn = screen.getByTestId("sidebar-sign-in");
		expect(sidebar.contains(signIn)).toBe(true);
		expect(signIn.getAttribute("href")).toBe("/auth/sign-in");
		expect(signIn.textContent).toMatch(/sign in/i);
	});

	it("does not show sidebar Sign in when authenticated", () => {
		render(
			<AppShell
				scope={{ mode: "authenticated", userId: "user-1" }}
				userName="Konrad"
			>
				<div>content</div>
			</AppShell>,
		);

		expect(screen.queryByTestId("sidebar-sign-in")).toBeNull();
	});
});
