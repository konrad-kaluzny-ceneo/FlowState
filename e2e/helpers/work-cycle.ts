import { expect, type Page } from "@playwright/test";

/** Advance fake clock through a 1s work cycle (+ buffer for completion tick). */
export const FAST_WORK_CLOCK_MS = 2500;

export async function setWorkDurationSec(page: Page, seconds: number) {
	await page.getByTestId("work-duration-custom-sec").fill(String(seconds));
}

export async function startFocusedWorkCycle(
	page: Page,
	taskTitle: string,
	durationSec: number,
) {
	await page.getByPlaceholder("Add a new task...").fill(taskTitle);
	await page.getByRole("button", { name: "Add" }).click();
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await expect(taskRow).toBeVisible();
	await taskRow.getByRole("button", { name: "Focus" }).click();
	await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
	await setWorkDurationSec(page, durationSec);
	await page.getByRole("button", { name: "Start Cycle" }).click();
	await expect(page.getByTestId("timer-panel-running")).toBeVisible();
}

export async function advanceClockThroughFastWork(page: Page) {
	await page.clock.install();
	await page.clock.runFor(FAST_WORK_CLOCK_MS);
}
