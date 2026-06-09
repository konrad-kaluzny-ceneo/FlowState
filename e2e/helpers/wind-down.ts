import { expect, type Page } from "@playwright/test";

import {
	focusTask,
	markTaskCompleteMidCycle,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./work-cycle";

export async function expectWindDownVisible(
	page: Page,
	options?: { rationale?: RegExp | string },
) {
	await expect(page.getByTestId("wind-down-overlay")).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByTestId("wind-down-keep-going-btn")).toBeVisible();
	await expect(page.getByTestId("wind-down-end-session-btn")).toBeVisible();

	if (options?.rationale != null) {
		await expect(page.getByTestId("wind-down-rationale")).toContainText(
			options.rationale,
		);
	}
}

export async function dismissWindDownKeepGoing(page: Page) {
	await expect(page.getByTestId("wind-down-overlay")).toBeVisible();
	await page.getByTestId("wind-down-keep-going-btn").click();
	await expect(page.getByTestId("wind-down-overlay")).toBeHidden({
		timeout: 15_000,
	});
}

export async function endSessionViaWindDown(page: Page) {
	await expect(page.getByTestId("wind-down-overlay")).toBeVisible();
	await page.getByTestId("wind-down-end-session-btn").click();
	await expect(page.getByTestId("wind-down-overlay")).toBeHidden({
		timeout: 15_000,
	});
}

export async function submitFadingCheckInExpectingWindDown(page: Page) {
	await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
		timeout: 15_000,
	});
	await page.getByRole("button", { name: "Continue later" }).click();
	await expect(page.getByText("Short Break")).toBeHidden();
	await expect(page.getByTestId("check-in-overlay")).toBeVisible();
	await page.getByTestId("check-in-energy-fading").click();
	await expectWindDownVisible(page);
}

export async function completeSteadyWorkCycleAndResumeIdle(page: Page) {
	await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
		timeout: 15_000,
	});
	await page.getByRole("button", { name: "Continue later" }).click();
	await expect(page.getByTestId("check-in-overlay")).toBeVisible({
		timeout: 10_000,
	});
	await page.getByTestId("check-in-energy-steady").click();
	await expect(page.getByTestId("check-in-overlay")).toBeHidden({
		timeout: 15_000,
	});
	await expect(page.getByTestId("timer-panel-running")).toContainText("Break", {
		timeout: 15_000,
	});
	await page.getByRole("button", { name: "End break early" }).click();
	await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
}

export async function startWorkCycleForMidCycleSwitches(
	page: Page,
	taskTitle: string,
	workDurationSec = 30,
) {
	await focusTask(page, taskTitle);
	await setShortBreakDurationSec(page, 1);
	await setWorkDurationSec(page, workDurationSec);
	await page.getByRole("button", { name: "Start Cycle" }).click();
	await expect(page.getByTestId("timer-panel-running")).toBeVisible();
}

export async function advanceClockThroughWorkSec(page: Page, seconds: number) {
	await page.clock.install();
	await page.clock.runFor(seconds * 1000 + 500);
}

export async function switchTaskMidCycle(
	page: Page,
	completedTask: string,
	nextTask: string,
) {
	await markTaskCompleteMidCycle(page, completedTask);
	await page
		.getByTestId("mid-cycle-prompt-overlay")
		.getByRole("button", { name: nextTask })
		.click();
	await page.getByTestId("mid-cycle-continue-btn").click();
	await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeHidden();
}
