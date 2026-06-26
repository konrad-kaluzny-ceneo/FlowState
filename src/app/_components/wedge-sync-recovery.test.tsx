import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PendingWedgeRecovery } from "~/hooks/use-pomodoro-cycle";

import { WedgeSyncRecovery } from "./wedge-sync-recovery";

/**
 * Browsers fire `click` when Enter is released on a focused native button.
 * jsdom does not implement that path, so key events precede the platform click.
 */
function activateButtonWithEnter(button: HTMLButtonElement) {
	button.focus();
	fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
	fireEvent.keyUp(button, { key: "Enter", code: "Enter" });
	button.click();
}

const baseRecovery: PendingWedgeRecovery = {
	message: "Could not save check-in. Try again.",
	phase: "check_in",
	energy: "FOCUSED",
};

function renderRecovery(
	overrides: Partial<{
		recovery: PendingWedgeRecovery;
		onRetry: () => void;
		onDismiss: () => void;
		isRetrying: boolean;
	}> = {},
) {
	const onRetry = overrides.onRetry ?? vi.fn();
	const onDismiss = overrides.onDismiss ?? vi.fn();

	render(
		<WedgeSyncRecovery
			isRetrying={overrides.isRetrying}
			onDismiss={onDismiss}
			onRetry={onRetry}
			recovery={overrides.recovery ?? baseRecovery}
		/>,
	);

	return { onRetry, onDismiss };
}

describe("WedgeSyncRecovery", () => {
	it("exposes a labelled recovery region", () => {
		renderRecovery();

		expect(screen.getByRole("region", { name: "Sync recovery" })).toBeTruthy();
		expect(screen.getByTestId("wedge-sync-recovery")).toBeTruthy();
	});

	it("announces recovery state through one polite live region", () => {
		renderRecovery();

		const liveRegions = screen.getAllByTestId(
			"wedge-sync-recovery-live-status",
		);
		expect(liveRegions).toHaveLength(1);
		expect(liveRegions[0]?.getAttribute("aria-live")).toBe("polite");
		expect(
			screen.getByText("Could not save check-in. Try again."),
		).toBeTruthy();
	});

	it("calls onRetry when Retry is clicked", () => {
		const onRetry = vi.fn();
		renderRecovery({ onRetry });

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("calls onRetry when Retry is activated from the keyboard", () => {
		const onRetry = vi.fn();
		renderRecovery({ onRetry });

		const retry = screen.getByRole("button", { name: "Retry" });
		expect(retry.tagName).toBe("BUTTON");
		expect(retry.getAttribute("type")).toBe("button");

		activateButtonWithEnter(retry as HTMLButtonElement);

		expect(onRetry).toHaveBeenCalledOnce();
	});
});
