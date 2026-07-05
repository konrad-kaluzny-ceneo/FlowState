import type { Locator, Page } from "@playwright/test";

/** Task row focus toggle (icon button aria-label). */
export function taskFocusButton(taskRow: Locator) {
	return taskRow.getByRole("button", { name: /^(Focus|Skup się)$/ });
}

/** Task row focus toggle when task is already focused. */
export function taskFocusedButton(taskRow: Locator) {
	return taskRow.getByRole("button", { name: /^(Focused|Skupione)$/ });
}

/** Task row mark-complete control. */
export function taskMarkCompleteButton(taskRow: Locator) {
	return taskRow.getByRole("button", {
		name: /Mark complete|Oznacz jako ukończone/i,
	});
}

/** Timer idle start control. */
export function startCycleButton(page: Page) {
	return page.getByTestId("timer-start-cycle");
}

/** Cycle-complete overlay secondary action. */
export function continueLaterButton(page: Page) {
	return page.getByRole("button", {
		name: /Continue later|Kontynuuj później/i,
	});
}
