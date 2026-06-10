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
	waitForSuggestionNext,
} from "./helpers/suggestion";
import {
	addTaskWithAttributes,
	advanceClockThroughFastBreak,
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	focusTask,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

test.describe("Adaptive task suggestion (S-06)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await resetWorkerSessionViaApi(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
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
		// Long break keeps the suggestion card visible while assertions run (belt-safe).
		await setShortBreakDurationSec(page, 120);
		await setWorkDurationSec(page, 1);
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
		await setShortBreakDurationSec(page, 1);
		await setWorkDurationSec(page, 1);
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
		test.setTimeout(120_000);

		const ts = Date.now();
		const deepTask = `E2E Expand Deep ${ts}`;
		const reactiveTask = `E2E Expand Reactive ${ts}`;

		await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
		await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");

		const deepRow = page
			.getByRole("listitem")
			.filter({ hasText: deepTask })
			.first();

		// Seed lastOverrideWorkType=DEEP_WORK via FADING check-in + override to deep.
		await focusTask(page, reactiveTask);
		await setShortBreakDurationSec(page, 1);
		await setWorkDurationSec(page, 1);
		await clickStartCycle(page);
		await advanceClockThroughFastWork(page);
		let suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "fading");
		await suggestionResponse;
		await expect(page.getByTestId("task-suggestion-card")).toBeVisible();
		await deepRow.getByRole("button", { name: "Focus" }).click();
		await expect(page.getByTestId("suggestion-override-ack")).toBeVisible();

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
		await setShortBreakDurationSec(page, 1);
		await setWorkDurationSec(page, 1);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0);
		await suggestionResponse;

		await expectSuggestionVisible(page, { title: deepTask });
		await expect(page.getByTestId("suggested-task-row")).toBeVisible();

		const reactiveRow = page
			.getByRole("listitem")
			.filter({ hasText: reactiveTask })
			.first();
		await reactiveRow.getByRole("button", { name: "Focus" }).click();

		await expect(page.getByTestId("suggestion-override-ack")).toBeVisible();
		await expect(page.getByTestId("suggestion-override-ack")).toContainText(
			/noted/i,
		);
		await expect(page.getByTestId("suggested-task-row")).toHaveCount(0);
		await expect(reactiveRow).toHaveClass(/ring-purple-500/);
	});
});
