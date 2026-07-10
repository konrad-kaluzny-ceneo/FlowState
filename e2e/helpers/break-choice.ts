import { expect, type Page } from "@playwright/test";

export type BreakChoiceKind = "short" | "long";

/**
 * Dismiss the break-choice overlay by choosing a break kind.
 *
 * The break-choice gate opens while the server asynchronously completes the
 * work cycle. The confirm button is disabled (breakChoicePending) until
 * `cycles.complete` resolves. We wait for the button to become enabled —
 * a deterministic signal that the server round-trip finished — then click.
 */
export async function chooseBreakKind(
	page: Page,
	kind: BreakChoiceKind = "short",
) {
	const overlay = page.getByTestId("break-choice-overlay");
	await expect(overlay).toBeVisible({ timeout: 15_000 });
	const testId = kind === "short" ? "break-choice-short" : "break-choice-long";
	const btn = page.getByTestId(testId);

	// The button starts disabled while cycles.complete is in-flight. Wait for it
	// to become enabled — this is the deterministic signal that the server
	// confirmed work-cycle completion and break creation is safe.
	await expect(btn).toBeEnabled({ timeout: 10_000 });

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
