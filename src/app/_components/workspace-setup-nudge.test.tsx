import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceSetupNudge } from "./workspace-setup-nudge";

describe("WorkspaceSetupNudge", () => {
	it("renders calm banner and wires open + dismiss actions", () => {
		const onOpenWorkspace = vi.fn();
		const onDismiss = vi.fn();

		render(
			<WorkspaceSetupNudge
				actionLabel="Open Workspace"
				body="A short checklist lives under Workspace."
				dismissLabel="Dismiss"
				onDismiss={onDismiss}
				onOpenWorkspace={onOpenWorkspace}
			/>,
		);

		expect(screen.getByTestId("settings-workspace-nudge")).toBeTruthy();

		fireEvent.click(screen.getByTestId("settings-workspace-nudge-action"));
		expect(onOpenWorkspace).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByTestId("settings-workspace-nudge-dismiss"));
		expect(onDismiss).toHaveBeenCalledTimes(1);
		expect(
			screen
				.getByRole("button", { name: "Dismiss" })
				.getAttribute("aria-label"),
		).toBe("Dismiss");
	});
});
