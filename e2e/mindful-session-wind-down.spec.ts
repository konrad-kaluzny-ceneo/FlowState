/**
 * Risk: S-16 / FR-019–FR-021 — mindful session wind-down gate ordering and override paths
 * Modeled on: e2e/seed.spec.ts, e2e/task-suggestion.spec.ts
 * Spec role: risk proof (trigger, keep-going, end-session, dismiss suppress, negatives)
 */
import type { Page } from "@playwright/test";

import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import {
	rehydrateFatigueSeedState,
	resetCycleRecoveryAfterReload,
} from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { completeKickoffReadiness } from "./helpers/kickoff";
import {
	resetWorkerSessionViaApi,
	seedWindDownFatigueScenario,
} from "./helpers/seed-scenario";
import { waitForSuggestionNext } from "./helpers/suggestion";
import { expectTaskListVisible } from "./helpers/task-list-locator";
import {
	expectShortBreakPhaseHidden,
	expectShortBreakPhaseVisible,
} from "./helpers/timer-phase";
import {
	advanceClockThroughWorkSec,
	completeSteadyWorkCycleAndResumeIdle,
	dismissWindDownKeepGoing,
	endSessionViaWindDown,
	expectWindDownVisible,
	startWorkCycleForMidCycleSwitches,
	submitFadingCheckInExpectingWindDown,
	switchTaskMidCycle,
} from "./helpers/wind-down";
import {
	addTask,
	addTasks,
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	ensureFakeClock,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

async function startFastWorkCycle(page: Page, taskTitle: string) {
	if (await page.getByTestId("session-energy-card").isVisible()) {
		await completeKickoffReadiness(page, "skip");
	}
	await focusTask(page, taskTitle);
	await setShortBreakDurationSec(page, 1);
	await setWorkDurationSec(page, 1);
	await clickStartCycle(page);
	await expect(page.getByTestId("timer-panel-running")).toBeVisible({
		timeout: 15_000,
	});
}

async function seedFatigueAndAdvanceToWindDownGate(
	page: Page,
	taskTitle: string,
) {
	const seed = await seedWindDownFatigueScenario(page, taskTitle, 1);
	await ensureFakeClock(page);
	await rehydrateFatigueSeedState(page, seed.sessionId);
	await advanceClockThroughFastWork(page);
}

test.describe("Mindful session wind-down (S-16)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		forgetFakeClock(page);
		await page.goto("/");
		await expectTaskListVisible(page);
		await waitForCycleGetActive(page);
		await resetWorkerSessionViaApi(page);
		forgetFakeClock(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await resetFakeClock(page);
		await ensureIdleCycle(page);
	});

	test("fatigue path triggers wind-down and blocks break until keep going", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E WindDown Fatigue ${Date.now()}`;

		await seedFatigueAndAdvanceToWindDownGate(page, taskTitle);
		await submitFadingCheckInExpectingWindDown(page);
		await expectWindDownVisible(page, {
			rationale: /energy dipping after 4 cycles/,
		});
		await expectShortBreakPhaseHidden(page);
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();
	});

	test("interruption path triggers wind-down with interruptions rationale @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const ts = Date.now();
		const task1 = `E2E WindDown Int A ${ts}`;
		const task2 = `E2E WindDown Int B ${ts}`;
		const task3 = `E2E WindDown Int C ${ts}`;

		await addTasks(page, [task1, task2, task3]);
		await startWorkCycleForMidCycleSwitches(page, task1);

		await switchTaskMidCycle(page, task1, task2);
		await switchTaskMidCycle(page, task2, task3);

		await advanceClockThroughWorkSec(page, 30);
		await submitFadingCheckInExpectingWindDown(page);
		await expectWindDownVisible(page, {
			rationale: /session had several interruptions/,
		});
	});

	test("keep going proceeds to break and suggestion @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(180_000);

		const ts = Date.now();
		const deepTask = `E2E WindDown Keep ${ts}`;
		const reactiveTask = `E2E WindDown Keep Rx ${ts}`;

		await addTask(page, deepTask);
		await addTask(page, reactiveTask);
		await startFastWorkCycle(page, deepTask);

		for (let cycle = 0; cycle < 3; cycle++) {
			await advanceClockThroughFastWork(page);
			await completeSteadyWorkCycleAndResumeIdle(page);
			await clickStartCycle(page);
			await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		}

		await advanceClockThroughFastWork(page);
		await submitFadingCheckInExpectingWindDown(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await dismissWindDownKeepGoing(page);
		await suggestionResponse;

		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("timer-panel-running")).toContainText(
			/Break/,
		);
		await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
			timeout: 20_000,
		});
	});

	test("end session path ends session without break or suggestion", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E WindDown End ${Date.now()}`;

		await seedFatigueAndAdvanceToWindDownGate(page, taskTitle);
		await submitFadingCheckInExpectingWindDown(page);
		await endSessionViaWindDown(page);

		await expect(page.getByTestId("end-session-btn")).toBeHidden({
			timeout: 15_000,
		});
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();
		await expect(page.getByPlaceholder("Add a new task...")).toBeEnabled();
		await expectTaskListVisible(page);
	});

	test("keep going suppresses wind-down until next check-in @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(240_000);

		const ts = Date.now();
		const taskTitle = `E2E WindDown Suppress ${ts}`;

		await addTask(page, taskTitle);
		await startFastWorkCycle(page, taskTitle);

		for (let cycle = 0; cycle < 3; cycle++) {
			await advanceClockThroughFastWork(page);
			await completeSteadyWorkCycleAndResumeIdle(page);
			await clickStartCycle(page);
			await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		}

		await advanceClockThroughFastWork(page);
		await submitFadingCheckInExpectingWindDown(page);
		await dismissWindDownKeepGoing(page);
		await page.getByRole("button", { name: "End break early" }).click();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();

		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();
		await completeCheckIn(page, "fading");
		await expect(page.getByTestId("wind-down-overlay")).toBeHidden();
		await expectShortBreakPhaseVisible(page);
	});

	test("steady or focused energy with fatigue skips wind-down @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(180_000);

		const ts = Date.now();
		const taskTitle = `E2E WindDown Neg Energy ${ts}`;

		await addTask(page, taskTitle);
		await startFastWorkCycle(page, taskTitle);

		for (let cycle = 0; cycle < 3; cycle++) {
			await advanceClockThroughFastWork(page);
			await completeSteadyWorkCycleAndResumeIdle(page);
			await clickStartCycle(page);
			await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		}

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "steady");
		await suggestionResponse;

		await expect(page.getByTestId("wind-down-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("timer-panel-running")).toContainText(
			/Break/,
		);
		await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
			timeout: 20_000,
		});
	});

	test("fading on first cycle without fatigue or interruptions skips wind-down @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const taskTitle = `E2E WindDown Neg Fatigue ${ts}`;

		await addTask(page, taskTitle);
		await startFastWorkCycle(page, taskTitle);

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "fading");
		await suggestionResponse;

		await expect(page.getByTestId("wind-down-overlay")).toBeHidden();
		await expectShortBreakPhaseVisible(page);
	});
});
