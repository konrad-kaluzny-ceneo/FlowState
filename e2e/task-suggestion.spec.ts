/**
 * Risk: S-06 / FR-021, FR-022 — adaptive task suggestion after check-in
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (suggestion wedge — accept + override)
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { completeKickoffReadiness } from "./helpers/kickoff";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	acceptSuggestion,
	expectSuggestionVisible,
	overrideSuggestionByFocusingTask,
	waitForSuggestionNext,
} from "./helpers/suggestion";
import {
	addTaskWithAttributes,
	advanceClockThroughBreakSec,
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

test.describe("Adaptive task suggestion (S-06)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
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
		if (await page.getByTestId("session-energy-card").isVisible()) {
			await completeKickoffReadiness(page, "skip");
		}
	});

	test("shows suggestion with rationale and highlighted row after check-in", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Deep ${ts}`;
		const reactiveTask = `E2E Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");
		await focusTask(page, deepTask);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("session-energy-card")).toHaveCount(0);
		await suggestionResponse;

		await expectSuggestionVisible(page, {
			title: deepTask,
			rationale: /Deep work — you're focused with few interruptions/,
		});
	});

	test("accept path pre-focuses task and break-end continue starts idle timer @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Accept Deep ${ts}`;
		const reactiveTask = `E2E Accept Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");
		await focusTask(page, deepTask);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("session-energy-card")).toHaveCount(0);
		await suggestionResponse;

		await expectSuggestionVisible(page, { title: deepTask });
		await acceptSuggestion(page);

		await advanceClockThroughBreakSec(page, 30);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByTestId("break-continue-suggested-btn"),
		).toBeVisible();
		await expect(
			page.getByTestId("break-continue-suggested-btn"),
		).toContainText(deepTask);
		await page.getByTestId("break-continue-suggested-btn").click();

		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
		await expect(
			page.getByTestId("timer-panel-idle").getByText(deepTask),
		).toBeVisible();
	});

	test("override path clears suggestion highlight when focusing another task @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Override Deep ${ts}`;
		const reactiveTask = `E2E Override Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");
		await focusTask(page, deepTask);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("session-energy-card")).toHaveCount(0);
		await suggestionResponse;

		await overrideSuggestionByFocusingTask(page, reactiveTask);
		await expect(page.getByTestId("suggestion-override-ack")).toContainText(
			/noted/i,
		);
		await expect(page.getByTestId("suggested-task-row")).toHaveCount(0);
		const reactiveRow = page
			.getByRole("listitem")
			.filter({ hasText: reactiveTask })
			.first();
		await expect(reactiveRow).toHaveClass(/ring-focus/);
	});
});
