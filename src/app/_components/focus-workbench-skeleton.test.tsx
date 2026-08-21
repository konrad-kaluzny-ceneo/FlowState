import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FocusWorkbenchSkeleton } from "~/app/_components/focus-workbench-skeleton";

describe("FocusWorkbenchSkeleton", () => {
	it("mirrors kickoff chrome and only pulses dynamic slots", () => {
		render(<FocusWorkbenchSkeleton />);

		const root = screen.getByTestId("dashboard-loading");
		expect(root.getAttribute("aria-busy")).toBe("true");
		expect(screen.getByText("Loading your focus view…")).toBeTruthy();

		// Most probable auth settle: kickoff chrome, not "Ready to focus?"
		expect(screen.getByTestId("focus-ready-kickoff-pending")).toBeTruthy();
		expect(screen.getByText("Ready to focus on")).toBeTruthy();
		expect(screen.queryByText("Ready to focus?")).toBeNull();

		expect(screen.getByText("Active and planned")).toBeTruthy();
		expect(screen.getByText("View all tasks →")).toBeTruthy();
		expect(screen.getByText("Today")).toBeTruthy();
		expect(screen.getByText("Your day")).toBeTruthy();
		expect(screen.getByTestId("focus-tip")).toBeTruthy();
		expect(screen.getByTestId("quick-actions")).toBeTruthy();
		expect(screen.getByTestId("focus-info-banner")).toBeTruthy();

		const pulses = root.querySelectorAll(".animate-pulse");
		expect(pulses.length).toBeGreaterThanOrEqual(3);
	});
});
