import { expect, type Page } from "@playwright/test";

/** Matches TimerPanel preset when NEXT_PUBLIC_E2E_FAST_DURATIONS=1. */
export const E2E_FAST_WORK_PRESET_LABEL = "1 sec";

/** Long enough to survive page.reload() network + hydration. */
export const E2E_RELOAD_WORK_PRESET_LABEL = "30 sec";

/** Advance fake clock through a 1s work preset (+ buffer for completion tick). */
export const FAST_WORK_CLOCK_MS = 2500;

export async function startFocusedWorkCycle(
	page: Page,
	taskTitle: string,
	durationLabel: string = E2E_FAST_WORK_PRESET_LABEL,
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
	await page.getByRole("button", { name: durationLabel }).click();
	await page.getByRole("button", { name: "Start Cycle" }).click();
	await expect(page.getByTestId("timer-panel-running")).toBeVisible();
}

export async function advanceClockThroughFastWork(page: Page) {
	await page.clock.install();
	await page.clock.runFor(FAST_WORK_CLOCK_MS);
}
