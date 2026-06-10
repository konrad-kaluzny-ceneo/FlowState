/**
 * Risk: S-06 / FR-021, FR-022 — adaptive task suggestion after check-in
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (suggestion wedge — accept + override)
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
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
		await ensureIdleCycle(page);
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
		await setShortBreakDurationSec(page, 1);
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

	test("accept path pre-focuses task and break-end continue starts idle timer", async ({
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

	test("override path clears suggestion highlight when focusing another task", async ({
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
