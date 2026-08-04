import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FocusWorkbenchSkeleton } from "./focus-workbench-skeleton";

describe("FocusWorkbenchSkeleton", () => {
	it("reserves workbench height with an accessible loading label", () => {
		render(<FocusWorkbenchSkeleton />);

		const root = screen.getByTestId("dashboard-loading");
		expect(root.getAttribute("aria-busy")).toBe("true");
		expect(screen.getByText("Loading your focus view…")).toBeTruthy();
	});
});
