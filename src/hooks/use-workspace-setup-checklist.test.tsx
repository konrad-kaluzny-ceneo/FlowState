import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { OnboardingScope } from "~/lib/onboarding/types";
import { WORKSPACE_SETUP_KEY_GUEST } from "~/lib/workspace-setup-advisor/keys";
import {
	readWorkspaceSetupState,
	writeDoneTipIds,
	writeNudgeDismissed,
} from "~/lib/workspace-setup-advisor/storage";
import type { WorkspaceTipId } from "~/lib/workspace-setup-advisor/types";

import { useWorkspaceSetupChecklist } from "./use-workspace-setup-checklist";

function ChecklistProbe({ scope }: { scope: OnboardingScope }) {
	const { doneTipIds, nudgeDismissed, toggleTip, dismissNudge } =
		useWorkspaceSetupChecklist(scope);

	return (
		<div>
			<span data-testid="done-ids">{doneTipIds.join(",")}</span>
			<span data-testid="nudge-dismissed">{String(nudgeDismissed)}</span>
			<button
				data-testid="toggle-cursor"
				onClick={() => toggleTip("cursor-agents")}
				type="button"
			>
				Toggle cursor
			</button>
			<button
				data-testid="toggle-slack"
				onClick={() => toggleTip("slack-dnd" satisfies WorkspaceTipId)}
				type="button"
			>
				Toggle slack
			</button>
			<button
				data-testid="toggle-os"
				onClick={() => toggleTip("os-focus")}
				type="button"
			>
				Toggle os
			</button>
			<button data-testid="dismiss-nudge" onClick={dismissNudge} type="button">
				Dismiss
			</button>
		</div>
	);
}

describe("useWorkspaceSetupChecklist integration", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("exposes nudge as not dismissed after client hydrate", async () => {
		render(<ChecklistProbe scope={{ mode: "guest" }} />);

		await waitFor(() => {
			expect(screen.getByTestId("nudge-dismissed").textContent).toBe("false");
		});
	});

	it("keeps nudge dismissed after hydrate when storage says so", async () => {
		// Prepopulate a non-default done tip so the assertion only holds once
		// hydration actually read storage (defaults would leave done-ids empty).
		writeDoneTipIds({ mode: "guest" }, ["cursor-agents"]);
		writeNudgeDismissed({ mode: "guest" }, true);

		render(<ChecklistProbe scope={{ mode: "guest" }} />);

		await waitFor(() => {
			expect(screen.getByTestId("done-ids").textContent).toBe("cursor-agents");
		});
		expect(screen.getByTestId("nudge-dismissed").textContent).toBe("true");
	});

	it("toggles tips and dismisses nudge against scoped storage", async () => {
		render(<ChecklistProbe scope={{ mode: "guest" }} />);

		await waitFor(() => {
			expect(screen.getByTestId("nudge-dismissed").textContent).toBe("false");
		});

		expect(screen.getByTestId("done-ids").textContent).toBe("");

		fireEvent.click(screen.getByTestId("toggle-cursor"));
		fireEvent.click(screen.getByTestId("dismiss-nudge"));

		expect(screen.getByTestId("done-ids").textContent).toBe("cursor-agents");
		expect(screen.getByTestId("nudge-dismissed").textContent).toBe("true");
		expect(readWorkspaceSetupState({ mode: "guest" })).toEqual({
			doneTipIds: ["cursor-agents"],
			nudgeDismissed: true,
		});
		expect(localStorage.getItem(WORKSPACE_SETUP_KEY_GUEST)).toContain(
			"cursor-agents",
		);
	});

	it("keeps guest and auth checklist state isolated", async () => {
		const { unmount } = render(<ChecklistProbe scope={{ mode: "guest" }} />);

		await waitFor(() => {
			expect(screen.getByTestId("nudge-dismissed").textContent).toBe("false");
		});

		fireEvent.click(screen.getByTestId("toggle-slack"));
		unmount();

		render(
			<ChecklistProbe scope={{ mode: "authenticated", userId: "user-a" }} />,
		);

		await waitFor(() => {
			expect(screen.getByTestId("nudge-dismissed").textContent).toBe("false");
		});

		expect(screen.getByTestId("done-ids").textContent).toBe("");

		fireEvent.click(screen.getByTestId("toggle-os"));

		expect(screen.getByTestId("done-ids").textContent).toBe("os-focus");
		expect(readWorkspaceSetupState({ mode: "guest" }).doneTipIds).toEqual([
			"slack-dnd",
		]);
		expect(
			readWorkspaceSetupState({
				mode: "authenticated",
				userId: "user-a",
			}).doneTipIds,
		).toEqual(["os-focus"]);
	});
});
