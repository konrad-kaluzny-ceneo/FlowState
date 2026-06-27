import { expect, type Locator, type Page } from "@playwright/test";

/** Task list scoped to the home shell — avoids strict-mode collisions during hydration. */
export function taskListLocator(page: Page): Locator {
	return page.locator("#home-shell-main").getByTestId("task-list").first();
}

export async function expectTaskListVisible(page: Page) {
	await expect(taskListLocator(page)).toBeVisible();
}
