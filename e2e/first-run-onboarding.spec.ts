/**
 * Risk: S-11 / FR-003b, proposed-FR-first-run-guidance — auth first-run, empty guide, wedge coaches
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (onboarding surfaces + sequential coach subcopy)
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
	findAuthOnboardingKey,
	getOnboardingStateFromStorage,
} from "./helpers/onboarding";
import {
	acceptSuggestion,
	expectSuggestionVisible,
	waitForSuggestionNext,
} from "./helpers/suggestion";
import {
	addTaskWithAttributes,
	advanceClockThroughFastBreak,
	advanceClockThroughFastWork,
	completeWorkCycleWithCheckIn,
	focusTask,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

async function resetAuthSessionForOnboarding(
	page: import("@playwright/test").Page,
) {
	await ensureIdleCycle(page);
	const endSession = page.getByTestId("end-session-btn");
	if ((await endSession.isVisible()) && (await endSession.isEnabled())) {
		await endSession.click();
		await expect(endSession).toBeHidden({ timeout: 10_000 });
	}
}

test.describe("First-run onboarding (S-11 auth path)", () => {
	test("first visit shows overlay, dismiss persists on reload", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await clearOnboardingKeys(page);
		await page.reload();
		await waitForCycleGetActive(page);

		await expect(page.getByTestId("first-run-overlay")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Your wedge workflow" }),
		).toBeVisible();

		await page.getByTestId("first-run-dismiss-btn").click();
		await expect(page.getByTestId("first-run-overlay")).toBeHidden();

		const onboardingKey = await findAuthOnboardingKey(page);
		expect(onboardingKey).not.toBeNull();
		const stateAfterDismiss = await getOnboardingStateFromStorage(
			page,
			onboardingKey as string,
		);
		expect(stateAfterDismiss?.firstRunDismissed).toBe(true);

		await page.reload();
		await waitForCycleGetActive(page);
		await expect(page.getByTestId("first-run-overlay")).toBeHidden();
	});

	test("empty active list shows guidance and CTA focuses add input", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await clearOnboardingKeys(page);
		await waitForCycleGetActive(page);
		await dismissFirstRunIfVisible(page);
		await ensureIdleCycle(page);

		await expect(page.getByTestId("empty-active-tasks-guide")).toBeVisible();
		await expect(page.getByTestId("empty-active-tasks-add-btn")).toBeVisible();

		await page.getByTestId("empty-active-tasks-add-btn").click();
		await expect(page.getByPlaceholder("Add a new task...")).toBeFocused();
	});

	test("check-in coach shows on first cycle only", async ({ page }) => {
		test.setTimeout(90_000);

		await page.goto("/");
		await clearOnboardingKeys(page);
		await waitForCycleGetActive(page);
		await dismissFirstRunIfVisible(page);
		await ensureIdleCycle(page);

		const ts = Date.now();
		const taskTitle = `E2E Coach CheckIn ${ts}`;

		await addTaskWithAttributes(page, taskTitle, "Deep", "Heavy");
		await focusTask(page, taskTitle);
		await setShortBreakDurationSec(page, 1);
		await setWorkDurationSec(page, 1);
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();
		await completeCheckIn(page, "steady", { expectCoach: true });

		await advanceClockThroughFastBreak(page);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("break-continue-btn").click();
		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();

		await focusTask(page, taskTitle);
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();
		await completeCheckIn(page, "steady", { expectCoach: false });
	});

	test("suggestion coach shows on first ready card only", async ({ page }) => {
		test.setTimeout(120_000);

		await page.goto("/");
		await clearOnboardingKeys(page);
		await waitForCycleGetActive(page);
		await dismissFirstRunIfVisible(page);
		await resetAuthSessionForOnboarding(page);

		const ts = Date.now();
		const deepTask = `E2E Coach Deep ${ts}`;
		const reactiveTask = `E2E Coach Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");
		await focusTask(page, deepTask);
		// Longer break window for suggestion coach assertion under shared auth session (CI).
		await setShortBreakDurationSec(page, 30);
		await setWorkDurationSec(page, 1);
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const firstSuggestion = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await firstSuggestion;

		await expectSuggestionVisible(page, {
			title: deepTask,
			expectCoach: true,
		});
		await acceptSuggestion(page);

		await page.clock.runFor(31_000);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("break-continue-suggested-btn").click();
		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();

		await focusTask(page, reactiveTask);
		await setShortBreakDurationSec(page, 1);
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const secondSuggestion = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await secondSuggestion;

		await expectSuggestionVisible(page, {
			expectCoach: false,
		});
	});

	test("accept path still works after first-run dismiss", async ({ page }) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await clearOnboardingKeys(page);
		await waitForCycleGetActive(page);
		await dismissFirstRunIfVisible(page);
		await resetAuthSessionForOnboarding(page);

		const ts = Date.now();
		const deepTask = `E2E Onboard Accept ${ts}`;
		const reactiveTask = `E2E Onboard Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");
		await focusTask(page, deepTask);
		await setShortBreakDurationSec(page, 1);
		await setWorkDurationSec(page, 1);
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await suggestionResponse;

		await expectSuggestionVisible(page, { title: deepTask });
		await acceptSuggestion(page);

		await advanceClockThroughFastBreak(page);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByTestId("break-continue-suggested-btn"),
		).toBeVisible();
		await page.getByTestId("break-continue-suggested-btn").click();

		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
	});
});
