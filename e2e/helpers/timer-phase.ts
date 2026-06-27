import { expect, type Page } from "@playwright/test";

type PhaseExpectOptions = { timeout?: number };

/** Assert the running timer shows the short-break phase label (locale-stable test id). */
export async function expectShortBreakPhaseVisible(
	page: Page,
	options?: PhaseExpectOptions,
) {
	await expect(
		page.getByTestId("timer-phase-label").filter({ hasText: "Short Break" }),
	).toBeVisible(options);
}

/** Assert the short-break phase label is not shown (break not started or on work). */
export async function expectShortBreakPhaseHidden(
	page: Page,
	options?: PhaseExpectOptions,
) {
	await expect(
		page.getByTestId("timer-phase-label").filter({ hasText: "Short Break" }),
	).toBeHidden(options);
}
