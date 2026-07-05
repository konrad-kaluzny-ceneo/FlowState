import { expect, type Locator, type Page } from "@playwright/test";

/** Task list scoped to the tasks page (post-UI-refactor lives at /tasks). */
export function taskListLocator(page: Page): Locator {
	return page.getByTestId("task-list").first();
}

export async function expectTaskListVisible(page: Page) {
	await expect(taskListLocator(page)).toBeVisible();
}

/** Navigate to /tasks and wait for the task list to be visible. */
export async function goToTasksPage(page: Page) {
	await page.goto("/tasks");
	await expectTaskListVisible(page);
}

/** Wait for the focus page to be ready (workbench grid, timer panel, or steering card mounted). */
export async function expectFocusPageReady(page: Page) {
	await expect(
		page
			.getByTestId("home-workbench-grid")
			.or(page.getByTestId("timer-panel-idle"))
			.or(page.getByTestId("timer-panel-running"))
			.or(page.getByTestId("timer-panel-paused"))
			.or(page.getByTestId("session-energy-card"))
			.first(),
	).toBeVisible({ timeout: 15_000 });
}
