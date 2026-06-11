/**
 * Risk: S-06 / FR-021, FR-022 — adaptive task suggestion after check-in
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (suggestion wedge — accept + override)
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
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
	advanceClockThroughFastBreak,
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	configureFastPomodoroDurations,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
} from "./helpers/work-cycle";

test.describe("Adaptive task suggestion (S-06)", () => {
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
		await resetFakeClock(page);
		await expect(page.getByTestId("task-list")).toBeVisible();
		if (await page.getByTestId("kickoff-readiness-overlay").isVisible()) {
			await completeKickoffReadiness(page, "skip");
		}
	});

	test.afterEach(async ({ page }) => {
		await resetWorkerSessionViaApi(page);
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
		await configureFastPomodoroDurations(page);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0);
		await suggestionResponse;

		await expectSuggestionVisible(page, {
			title: deepTask,
			rationale: /Deep work — you're focused with few interruptions/,
		});
		await expect(page.getByTestId("suggested-task-row")).toBeVisible();
		await expect(
			page.getByTestId("suggested-task-row").filter({ hasText: deepTask }),
		).toBeVisible();
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
		await configureFastPomodoroDurations(page);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0);
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

	test("expands Why this? breakdown when secondary factors exist @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Expand Deep ${ts}`;
		const reactiveTask = `E2E Expand Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");

		// Seed lastOverrideWorkType=DEEP_WORK via FADING check-in + override to deep.
		await focusTask(page, reactiveTask);
		await configureFastPomodoroDurations(page);
		await clickStartCycle(page);
		await advanceClockThroughFastWork(page);
		let suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "fading");
		await suggestionResponse;
		await overrideSuggestionByFocusingTask(page, deepTask);

		await advanceClockThroughFastBreak(page);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("break-continue-suggested-btn").click();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();

		await focusTask(page, deepTask);
		await clickStartCycle(page);
		await advanceClockThroughFastWork(page);
		suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await suggestionResponse;

		await expectSuggestionVisible(page, { title: deepTask });
		await expect(page.getByTestId("suggestion-rationale-toggle")).toBeVisible();
		await page.getByTestId("suggestion-rationale-toggle").click();
		await expect(
			page.getByTestId("suggestion-rationale-expander"),
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
		await configureFastPomodoroDurations(page);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0);
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
		await expect(reactiveRow).toHaveClass(/ring-purple-500/);
	});
});
