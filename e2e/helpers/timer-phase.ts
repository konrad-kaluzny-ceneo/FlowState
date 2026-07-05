import { expect, type Page } from "@playwright/test";

type PhaseExpectOptions = { timeout?: number };

const SHORT_BREAK_PHASE = /Short [Bb]reak|Krótka przerwa/;

function shortBreakPhaseLabel(page: Page) {
	return page
		.getByTestId("timer-phase-label")
		.filter({ hasText: SHORT_BREAK_PHASE });
}

/** Assert the running timer shows the short-break phase label (locale-stable test id). */
export async function expectShortBreakPhaseVisible(
	page: Page,
	options?: PhaseExpectOptions,
) {
	await expect(shortBreakPhaseLabel(page)).toBeVisible(options);
}

/** Assert the short-break phase label is not shown (break not started or on work). */
export async function expectShortBreakPhaseHidden(
	page: Page,
	options?: PhaseExpectOptions,
) {
	await expect(shortBreakPhaseLabel(page)).toBeHidden(options);
}

/** Poll helper for check-in completion — break label or overlay dismissed. */
export function isShortBreakPhaseVisible(page: Page) {
	return shortBreakPhaseLabel(page).isVisible();
}
