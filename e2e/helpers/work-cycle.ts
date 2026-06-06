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

export async function addTask(page: Page, title: string) {
	await page.getByPlaceholder("Add a new task...").fill(title);
	await page.getByRole("button", { name: "Add" }).click();
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible();
}

export async function addTasks(page: Page, titles: string[]) {
	for (const title of titles) {
		await addTask(page, title);
	}
}

export async function markTaskCompleteMidCycle(page: Page, taskTitle: string) {
	await expect(page.getByTestId("timer-panel-running")).toBeVisible();
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await taskRow.getByRole("button", { name: "Mark complete" }).click();
}

export async function advanceClockThroughFastWork(page: Page) {
	await page.clock.install();
	await page.clock.runFor(FAST_WORK_CLOCK_MS);
}
