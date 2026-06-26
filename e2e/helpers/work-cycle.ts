import { expect, type Locator, type Page } from "@playwright/test";

import { splitSecToMinSec } from "../../src/lib/duration-input";
import { completeCheckIn } from "./check-in";
import {
	dismissBreakAlertsPermissionIfVisible,
	dismissCycleCompleteIfVisible,
	dismissKickoffReadinessIfVisible,
	dismissTaskSuggestionIfVisible,
	waitForTimerPanelIdle,
} from "./idle-cycle";
import {
	dismissFirstRunIfVisible,
	dismissPresetCoachIfVisible,
} from "./onboarding";

/** Advance fake clock through a 1s work cycle (+ buffer for completion tick). */
export const FAST_WORK_CLOCK_MS = 2500;

/** Advance fake clock through a 1s break (+ buffer for completion tick). */
export const FAST_BREAK_CLOCK_MS = 2500;

const clockInstalledPages = new WeakSet<Page>();

/** Call after navigation/reload so the next ensureFakeClock installs fresh timers. */
export function forgetFakeClock(page: Page) {
	clockInstalledPages.delete(page);
}

/** Install Playwright fake timers once per test phase — never re-sync to wall clock mid-cycle. */
export async function ensureFakeClock(page: Page) {
	if (clockInstalledPages.has(page)) {
		return;
	}
	await page.clock.install();
	clockInstalledPages.add(page);
}

/** Fresh fake timers between tests on a reused worker page (clears pending intervals). */
export async function resetFakeClock(page: Page) {
	forgetFakeClock(page);
	await page.clock.install();
	clockInstalledPages.add(page);
}

/**
 * 1s work + 1s break. UI cycle starts via `clickStartCycle` / `startFocusedWorkCycle`
 * install the fake clock automatically; still call `advanceClockThroughFast*` to advance time.
 */
export async function configureFastPomodoroDurations(page: Page) {
	await setShortBreakDurationSec(page, 1);
	await setWorkDurationSec(page, 1);
}

async function waitForTaskCreateSettled(addButton: Locator) {
	await expect(addButton).not.toHaveAttribute("aria-busy", "true", {
		timeout: 15_000,
	});
}

/** Belt specs expect generic tasks — uncheck daily standing default for create flows. */
async function uncheckDailyStandingDefault(page: Page) {
	const toggle = page.getByTestId("daily-standing-toggle");
	if (!(await toggle.isVisible())) {
		return;
	}
	if (await toggle.isChecked()) {
		await page.getByText("Daily standing", { exact: true }).click();
		await expect(toggle).not.toBeChecked();
	}
}

async function isGuestDashboard(page: Page) {
	return page.getByTestId("guest-banner").isVisible();
}

function isCycleCreatePost(response: {
	url: () => string;
	request: () => { method: () => string; postData: () => string | null };
}) {
	if (response.request().method() !== "POST") {
		return false;
	}
	const url = response.url();
	const postData = response.request().postData() ?? "";
	return url.includes("cycle.create") || postData.includes("cycle.create");
}

/** Wait for optimistic start to persist the cycle before server mutations (auth only). */
export async function waitForCycleCreateSettled(page: Page) {
	if (await isGuestDashboard(page)) {
		return;
	}

	const timeout = 15_000;
	const deadline = Date.now() + timeout;

	while (Date.now() < deadline) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			break;
		}
		const response = await page.waitForResponse(isCycleCreatePost, {
			timeout: remaining,
		});
		if (response.ok()) {
			return;
		}
	}
	throw new Error("cycle.create did not return ok within timeout");
}

/**
 * Click Start Cycle and await server create on authenticated dashboards.
 *
 * E2E client timer mode (`NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`) computes cycle expiry
 * from client `Date.now()`, so the fake clock must be installed before Start Cycle —
 * otherwise sub-second cycles race the real wall clock (`e2e-belt-timer-flakiness`).
 */
export async function clickStartCycle(page: Page) {
	await ensureFakeClock(page);
	await dismissFirstRunIfVisible(page);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	const createSettled = waitForCycleCreateSettled(page);
	await page.getByRole("button", { name: "Start Cycle" }).click();
	await dismissBreakAlertsPermissionIfVisible(page);
	await createSettled;
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
	await dismissFirstRunIfVisible(page);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await uncheckDailyStandingDefault(page);
	await page.getByPlaceholder("Add a new task...").fill(taskTitle);
	await dismissCycleCompleteIfVisible(page);
	await page.getByRole("button", { name: "Add", exact: true }).click();
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await expect(taskRow).toBeVisible();
	await waitForTaskCreateSettled(
		page.getByRole("button", { name: "Add", exact: true }),
	);
	await dismissKickoffReadinessIfVisible(page);
	await dismissTaskSuggestionIfVisible(page);
	const focusBtn = taskRow.getByRole("button", { name: "Focus" });
	await expect(focusBtn).toBeEnabled({ timeout: 15_000 });
	await focusBtn.click();
	await waitForTimerPanelIdle(page);
	await dismissKickoffReadinessIfVisible(page);
	await setWorkDurationSec(page, durationSec);
	if (durationSec === 1) {
		await setShortBreakDurationSec(page, 1);
	}
	await dismissKickoffReadinessIfVisible(page);
	await clickStartCycle(page);
	await expect(page.getByTestId("timer-panel-running")).toBeVisible({
		timeout: 15_000,
	});
}

export async function addTask(page: Page, title: string) {
	const addButton = page.getByRole("button", { name: "Add", exact: true });
	await dismissFirstRunIfVisible(page);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await uncheckDailyStandingDefault(page);
	await page.getByPlaceholder("Add a new task...").fill(title);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
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
	await ensureFakeClock(page);
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
	await ensureFakeClock(page);
	await page.clock.runFor(FAST_BREAK_CLOCK_MS);
}

export async function advanceClockThroughBreakSec(page: Page, seconds: number) {
	await ensureFakeClock(page);
	await page.clock.runFor(seconds * 1000 + 500);
}

type TaskWorkTypeLabel = "Deep" | "Ops" | "Reactive";
type TaskWeightLabel = "Light" | "Medium" | "Heavy";

/** Belt helpers use the Custom panel by design — persona chips are not required for belt specs. */
export async function addTaskWithAttributes(
	page: Page,
	title: string,
	workType: TaskWorkTypeLabel,
	weight: TaskWeightLabel,
) {
	await dismissFirstRunIfVisible(page);
	await dismissPresetCoachIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	const addForm = page.getByTestId("task-list").locator("form");
	const customButton = addForm.getByTestId("persona-preset-custom");
	const detailsToggle = addForm.getByRole("button", { name: "+ Details" });
	if (await customButton.isVisible()) {
		await dismissKickoffReadinessIfVisible(page);
		await customButton.click();
		await expect(addForm.getByTestId("create-task-custom-panel")).toBeVisible();
	} else if (await detailsToggle.isVisible()) {
		await dismissFirstRunIfVisible(page);
		await dismissKickoffReadinessIfVisible(page);
		await detailsToggle.click();
	}
	await dismissKickoffReadinessIfVisible(page);
	const customPanel = addForm.getByTestId("create-task-custom-panel");
	await customPanel
		.getByRole("button", { name: workType, exact: true })
		.click();
	await dismissKickoffReadinessIfVisible(page);
	const urgencyRow = customPanel
		.locator("div")
		.filter({ hasText: /^Urgency/ })
		.first();
	await urgencyRow.getByRole("button", { name: weight }).click();
	await uncheckDailyStandingDefault(page);
	await page.getByPlaceholder("Add a new task...").fill(title);
	const addButton = addForm.getByRole("button", { name: "Add" });
	await dismissKickoffReadinessIfVisible(page);
	await addButton.click();
	await dismissKickoffReadinessIfVisible(page);
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible();
	await waitForTaskCreateSettled(addButton);
}

export async function focusTask(page: Page, taskTitle: string) {
	await dismissKickoffReadinessIfVisible(page);
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await expect(taskRow).toBeVisible({ timeout: 15_000 });
	const focusBtn = taskRow.getByRole("button", { name: "Focus" });
	await expect(focusBtn).toBeEnabled({ timeout: 15_000 });
	await focusBtn.click();
	await waitForTimerPanelIdle(page);
}

async function dismissWindDownIfVisible(page: Page) {
	if (await page.getByTestId("wind-down-overlay").isVisible()) {
		await page.getByTestId("wind-down-keep-going-btn").click();
		await expect(page.getByTestId("wind-down-overlay")).toBeHidden();
	}
}

export async function completeWorkCycleWithCheckIn(
	page: Page,
	energy: "focused" | "steady" | "fading",
) {
	await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
		timeout: 15_000,
	});
	await dismissKickoffReadinessIfVisible(page);
	await page.getByRole("button", { name: "Continue later" }).click();
	await expect(page.getByText("Short Break")).toBeHidden();
	await completeCheckIn(page, energy);
	await dismissWindDownIfVisible(page);
}
