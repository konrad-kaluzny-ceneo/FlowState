import { expect, type Locator, type Page } from "@playwright/test";
import { splitSecToMinSec } from "../../src/lib/duration-input";
import { completeCheckIn } from "./check-in";
import {
	continueLaterButton,
	startCycleButton,
	taskFocusButton,
	taskFocusedButton,
	taskMarkCompleteButton,
} from "./i18n-locators";
import {
	dismissBreakAlertsPermissionIfVisible,
	dismissCycleCompleteIfVisible,
	dismissKickoffReadinessIfVisible,
	dismissTaskSuggestionIfVisible,
	waitForTimerPanelIdle,
} from "./idle-cycle";
import { dismissFirstRunIfVisible } from "./onboarding";
import { taskListLocator } from "./task-list-locator";
import { expectShortBreakPhaseHidden } from "./timer-phase";

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

async function isGuestDashboard(page: Page) {
	// Guest mode: no auth session cookie present. Check for the session cookie
	// that Neon Auth / next-auth sets.
	const cookies = await page.context().cookies();
	const hasSessionCookie = cookies.some(
		(c) =>
			c.name === "__Secure-authjs.session-token" ||
			c.name === "authjs.session-token" ||
			c.name === "__Secure-next-auth.session-token" ||
			c.name === "next-auth.session-token",
	);
	return !hasSessionCookie;
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

/** Navigate to /tasks if not already there. */
async function ensureOnTasksPage(page: Page) {
	if (!page.url().includes("/tasks")) {
		await page.goto("/tasks");
	}
	await expect(taskListLocator(page)).toBeVisible({ timeout: 15_000 });
}

/** Inline quick-add input (EN + PL placeholders after task-list UI refactor). */
function quickAddInput(page: Page) {
	return page.getByPlaceholder(/\+ Add a task|\+ Dodaj zadanie/);
}

/** Icon submit beside quick-add (aria-label Add / Dodaj). */
function quickAddButton(page: Page) {
	return page.getByRole("button", { name: /^(Add|Dodaj)$/, exact: true });
}

/** Click the visible focus nav link (sidebar on desktop, bottom nav on mobile). */
async function clickNavFocus(page: Page) {
	// Both nav containers exist in DOM always (one hidden via CSS breakpoints).
	// Try mobile first (most tests run at mobile viewport), fall back to desktop.
	const mobileNav = page.getByTestId("nav-mobile-focus");
	const desktopNav = page.getByTestId("nav-focus");

	// Wait for at least one nav to be attached (page hydrated)
	await expect(mobileNav.or(desktopNav).first()).toBeAttached({
		timeout: 10_000,
	});

	// Use JS-level click via evaluate to bypass the Next.js dev overlay
	// (nextjs-portal) which intercepts pointer events in guest mode.
	if (await mobileNav.isVisible().catch(() => false)) {
		await mobileNav.evaluate((el) => (el as HTMLAnchorElement).click());
	} else {
		await desktopNav.evaluate((el) => (el as HTMLAnchorElement).click());
	}
	await expect(page).toHaveURL(/\/focus/, { timeout: 10_000 });
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
	await startCycleButton(page).click();
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
	// Navigate to /tasks to add and focus the task
	await ensureOnTasksPage(page);
	await dismissFirstRunIfVisible(page);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await quickAddInput(page).fill(taskTitle);
	await dismissCycleCompleteIfVisible(page);
	await quickAddButton(page).click();
	// Quick-add creates tasks as "planned" — switch to Planned tab to find it
	await page.getByRole("tab", { name: /Planned|Planowane/i }).click();
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();
	await expect(taskRow).toBeVisible({ timeout: 15_000 });
	await waitForTaskCreateSettled(quickAddButton(page));
	await dismissKickoffReadinessIfVisible(page);
	await dismissTaskSuggestionIfVisible(page);
	const focusBtn = taskFocusButton(taskRow);
	await expect(focusBtn).toBeEnabled({ timeout: 15_000 });
	await focusBtn.click();
	// Wait for focus to register in the cycle context (aria-label flips to focused state).
	await expect(taskFocusedButton(taskRow)).toBeVisible({ timeout: 5_000 });

	// Navigate to /focus via client-side link to preserve React context state
	// (focusedTaskId is React state, lost on hard navigation)
	await clickNavFocus(page);
	await waitForTimerPanelIdle(page);
	await dismissKickoffReadinessIfVisible(page);
	if (durationSec === 1) {
		// Set break duration before work duration to avoid nav resetting the input
		await setShortBreakDurationSec(page, 1);
	}
	await setWorkDurationSec(page, durationSec);
	await dismissKickoffReadinessIfVisible(page);
	await clickStartCycle(page);
	await expect(page.getByTestId("timer-panel-running")).toBeVisible({
		timeout: 15_000,
	});
}

export async function addTask(page: Page, title: string) {
	await ensureOnTasksPage(page);
	const addButton = quickAddButton(page);
	await dismissFirstRunIfVisible(page);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await quickAddInput(page).fill(title);
	await dismissCycleCompleteIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);
	await addButton.click();
	// Quick-add creates tasks as "planned" — switch to Planned tab to find it
	await page.getByRole("tab", { name: /Planned|Planowane/i }).click();
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible({ timeout: 15_000 });
	await waitForTaskCreateSettled(addButton);
}

export async function addTasks(page: Page, titles: string[]) {
	for (const title of titles) {
		await addTask(page, title);
	}
}

export async function markTaskCompleteMidCycle(page: Page, taskTitle: string) {
	// The mid-cycle prompt needs to be triggered via onMidCycleMarkComplete which
	// only fires from the task list UI. Navigate to /tasks using client-side link
	// (preserves React context including the running cycle state).
	// Note: fake clock is installed but client-side nav should still work since
	// it uses React transitions, not raw setTimeout.
	const navLink = page
		.getByTestId("nav-tasks")
		.or(page.getByTestId("nav-mobile-tasks"))
		.first();
	await navLink.click({ timeout: 10_000 });
	await expect(page.getByTestId("task-list")).toBeVisible({ timeout: 15_000 });

	// The focused/started task should be in Active tab (cycle start promotes planned → active)
	// But the client cache may be stale — check all tabs
	const activeTab = page.getByRole("tab", { name: /Active|Aktywne/i });
	const plannedTab = page.getByRole("tab", { name: /Planned|Planowane/i });
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();

	// Try Active tab first
	if (await activeTab.isVisible()) {
		await activeTab.click();
	}
	if (!(await taskRow.isVisible().catch(() => false))) {
		// Task might still appear as planned if cache is stale
		if (await plannedTab.isVisible()) {
			await plannedTab.click();
		}
	}
	await expect(taskRow).toBeVisible({ timeout: 15_000 });
	await taskMarkCompleteButton(taskRow).click();

	// Navigate back to /focus via client-side nav
	await clickNavFocus(page);
	await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeVisible({
		timeout: 15_000,
	});
}

export async function advanceClockThroughFastWork(page: Page) {
	await ensureFakeClock(page);
	await page.clock.runFor(FAST_WORK_CLOCK_MS);
}

export async function setShortBreakDurationSec(page: Page, seconds: number) {
	// Break duration is stored in localStorage — set it directly to avoid
	// navigating to /settings (which adds latency and breaks fake-clock flows).
	await page.evaluate((sec) => {
		localStorage.setItem("flowstate:shortBreakDurationSec", String(sec));
	}, seconds);
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

/** Belt helpers use the add-task modal with Custom panel for attribute control. */
export async function addTaskWithAttributes(
	page: Page,
	title: string,
	workType: TaskWorkTypeLabel,
	weight: TaskWeightLabel,
) {
	await ensureOnTasksPage(page);
	await dismissFirstRunIfVisible(page);
	await dismissKickoffReadinessIfVisible(page);

	// Open the add-task modal via gear icon
	await page.getByTestId("open-add-task-modal").click();
	const modal = page.getByTestId("add-task-modal");
	await expect(modal).toBeVisible({ timeout: 5_000 });

	// Click Custom to show attribute fields
	await modal.getByTestId("persona-preset-custom").click();

	// Set work type via SegmentedControl
	await modal.getByRole("button", { name: workType, exact: true }).click();

	// Set urgency via SegmentedControl
	const urgencyRow = modal
		.locator("div")
		.filter({ hasText: /^Urgency/ })
		.first();
	await urgencyRow.getByRole("button", { name: weight }).click();

	// Check "Daily standing" so the task is created as active (matching pre-refactor behavior)
	const dailyToggle = modal.getByTestId("daily-standing-toggle");
	if (!(await dailyToggle.isChecked())) {
		// The checkbox is sr-only; click via its label
		await modal.getByText("Daily standing", { exact: true }).click();
	}

	// Fill title
	await modal.getByTestId("task-fields-title").fill(title);

	// Submit
	await modal.getByRole("button", { name: "Add task", exact: true }).click();
	await expect(modal).toBeHidden({ timeout: 10_000 });

	// Task is created as active (isDailyStanding) — should appear in Active tab
	await page.getByRole("tab", { name: /Active|Aktywne/i }).click();
	await expect(
		page.getByRole("listitem").filter({ hasText: title }).first(),
	).toBeVisible({ timeout: 15_000 });
}

export async function focusTask(page: Page, taskTitle: string) {
	await ensureOnTasksPage(page);
	await dismissKickoffReadinessIfVisible(page);
	const taskRow = page
		.getByRole("listitem")
		.filter({ hasText: taskTitle })
		.first();

	// Task could be on Active or Planned tab — try Active first, then Planned
	const activeTab = page.getByRole("tab", { name: /Active|Aktywne/i });
	const plannedTab = page.getByRole("tab", { name: /Planned|Planowane/i });
	if (await activeTab.isVisible().catch(() => false)) {
		await activeTab.click();
	}
	if (!(await taskRow.isVisible().catch(() => false))) {
		if (await plannedTab.isVisible().catch(() => false)) {
			await plannedTab.click();
		}
	}
	await expect(taskRow).toBeVisible({ timeout: 15_000 });
	const focusBtn = taskFocusButton(taskRow);
	await expect(focusBtn).toBeEnabled({ timeout: 15_000 });
	await focusBtn.click();
	// Navigate to /focus via client-side nav to preserve context
	await clickNavFocus(page);
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
	await continueLaterButton(page).click();
	await expectShortBreakPhaseHidden(page);
	await completeCheckIn(page, energy);
	await dismissWindDownIfVisible(page);
}
