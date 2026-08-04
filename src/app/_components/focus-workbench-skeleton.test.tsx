import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FocusWorkbenchSkeleton } from "./focus-workbench-skeleton";

describe("FocusWorkbenchSkeleton", () => {
	it("mirrors FocusReady chrome and only pulses dynamic slots", () => {
		render(<FocusWorkbenchSkeleton />);

		const root = screen.getByTestId("dashboard-loading");
		expect(root.getAttribute("aria-busy")).toBe("true");
		expect(screen.getByText("Loading your focus view…")).toBeTruthy();

		// Static FocusReady copy — not placeholder bars
		expect(screen.getByText("Ready to focus?")).toBeTruthy();
		expect(screen.getByText("Choose a task to start a session.")).toBeTruthy();
		expect(screen.getByText("+ Choose task")).toBeTruthy();
		expect(screen.getByText("Active and planned")).toBeTruthy();
		expect(screen.getByText("View all tasks →")).toBeTruthy();

		// Static rail chrome
		expect(screen.getByText("Your day")).toBeTruthy();
		expect(screen.getByTestId("focus-tip")).toBeTruthy();
		expect(screen.getByTestId("quick-actions")).toBeTruthy();
		expect(screen.getByTestId("focus-info-banner")).toBeTruthy();

		const pulses = root.querySelectorAll(".animate-pulse");
		expect(pulses.length).toBeGreaterThanOrEqual(6);
		// Heading itself must not be a pulse bar
		expect(screen.getByText("Ready to focus?").className).not.toMatch(
			/animate-pulse/,
		);
	});
});
