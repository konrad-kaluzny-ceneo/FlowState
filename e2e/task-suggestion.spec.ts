/**
 * Risk: S-06 / FR-021, FR-022 — adaptive task suggestion after check-in
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (suggestion wedge — accept + override)
 */
import { expect, test } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { completeKickoffReadiness } from "./helpers/kickoff";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	expectSuggestionVisible,
	waitForSuggestionNext,
} from "./helpers/suggestion";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import {
	addTaskWithAttributes,
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
		await page.goto("/focus");
		await expectFocusPageReady(page);
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
});
