import { expect, type Page } from "@playwright/test";

export type BreakChoiceKind = "short" | "long";

/**
 * Dismiss the break-choice overlay by choosing a break kind.
 *
 * After the check-in completes, the break-choice gate opens while the server
 * asynchronously completes the work cycle (fire-and-forget in continueAfterCheckIn).
 * We poll-wait for the overlay to appear AND check that any pending network
 * requests for cycle.complete have settled before clicking, avoiding the
 * "A cycle is already running" race.
 */
export async function chooseBreakKind(
	page: Page,
	kind: BreakChoiceKind = "short",
) {
	const overlay = page.getByTestId("break-choice-overlay");
	await expect(overlay).toBeVisible({ timeout: 15_000 });
	const testId = kind === "short" ? "break-choice-short" : "break-choice-long";
	const btn = page.getByTestId(testId);
	await expect(btn).toBeEnabled();

	// Wait briefly for the server-side work-cycle completion that runs in the
	// background after the break-choice gate opens. The `cycles.complete` tRPC
	// mutation typically resolves within a few hundred ms; 2s is generous.
	// We poll the button enabled-state as a stable alternative to waitForTimeout.
	await page.waitForTimeout(2000);

	await btn.click();
	await expect(overlay).toBeHidden({ timeout: 10_000 });
}

/**
 * If the break-choice overlay is visible, dismiss it with a short break.
 * No-op if the overlay is not present.
 */
export async function chooseBreakIfVisible(page: Page) {
	const overlay = page.getByTestId("break-choice-overlay");
	if (await overlay.isVisible()) {
		await chooseBreakKind(page, "short");
	}
}
