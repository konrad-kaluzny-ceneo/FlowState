import { expect, type Page } from "@playwright/test";

import { splitSecToMinSec } from "../../src/lib/duration-input";

/** Advance fake clock through a 1s work cycle (+ buffer for completion tick). */
export const FAST_WORK_CLOCK_MS = 2500;

export async function setWorkDurationSec(page: Page, seconds: number) {
	const { minutes, seconds: secs } = splitSecToMinSec(seconds);
	await page.getByTestId("work-duration-min").fill(String(minutes));
	await page.getByTestId("work-duration-sec").fill(String(secs));
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
