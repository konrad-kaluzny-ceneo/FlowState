import { expect, type Locator, type Page } from "@playwright/test";

import { splitSecToMinSec } from "../../src/lib/duration-input";
import { completeCheckIn } from "./check-in";

/** Advance fake clock through a 1s work cycle (+ buffer for completion tick). */
export const FAST_WORK_CLOCK_MS = 2500;

/** Advance fake clock through a 1s break (+ buffer for completion tick). */
export const FAST_BREAK_CLOCK_MS = 2500;

async function waitForTaskCreateSettled(addButton: Locator) {
	await expect(addButton).not.toHaveText("Adding...", { timeout: 15_000 });
}

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
	await page.getByRole("button", { name: "Add", exact: true }).click();
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await expect(taskRow).toBeVisible();
	await waitForTaskCreateSettled(
		page.getByRole("button", { name: "Add", exact: true }),
	);
	await taskRow.getByRole("button", { name: "Focus" }).click();
	await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
	await setWorkDurationSec(page, durationSec);
	await page.getByRole("button", { name: "Start Cycle" }).click();
	await expect(page.getByTestId("timer-panel-running")).toBeVisible();
}

export async function addTask(page: Page, title: string) {
	const addButton = page.getByRole("button", { name: "Add", exact: true });
	await page.getByPlaceholder("Add a new task...").fill(title);
	await addButton.click();
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible();
	await waitForTaskCreateSettled(addButton);
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

export async function setShortBreakDurationSec(page: Page, seconds: number) {
	const { minutes, seconds: secs } = splitSecToMinSec(seconds);
	const panel = page.getByTestId("break-settings-panel");
	if (!(await panel.isVisible())) {
		await page.getByTestId("break-settings-toggle").click();
	}
	await page.getByTestId("short-break-duration-min").fill(String(minutes));
	await page.getByTestId("short-break-duration-sec").fill(String(secs));
}

export async function advanceClockThroughFastBreak(page: Page) {
	await page.clock.runFor(FAST_BREAK_CLOCK_MS);
}

type TaskWorkTypeLabel = "Deep" | "Ops" | "Reactive";
type TaskWeightLabel = "Light" | "Medium" | "Heavy";

export async function addTaskWithAttributes(
	page: Page,
	title: string,
	workType: TaskWorkTypeLabel,
	weight: TaskWeightLabel,
) {
	const addForm = page.getByTestId("task-list").locator("form");
	const detailsToggle = addForm.getByRole("button", { name: "+ Details" });
	if (await detailsToggle.isVisible()) {
		await detailsToggle.click();
	}
	await addForm.getByRole("button", { name: workType }).click();
	await addForm.getByRole("button", { name: weight }).click();
	await page.getByPlaceholder("Add a new task...").fill(title);
	const addButton = addForm.getByRole("button", { name: "Add" });
	await addButton.click();
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible();
	await waitForTaskCreateSettled(addButton);
}

export async function focusTask(page: Page, taskTitle: string) {
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await taskRow.getByRole("button", { name: "Focus" }).click();
	await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
}

export async function completeWorkCycleWithCheckIn(
	page: Page,
	energy: "focused" | "steady" | "fading",
) {
	await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
		timeout: 15_000,
	});
	await page.getByRole("button", { name: "Continue later" }).click();
	await expect(page.getByText("Short Break")).toBeHidden();
	await completeCheckIn(page, energy);
}
