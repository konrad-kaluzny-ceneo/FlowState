/**
 * Risk: S-27 / US-03 — daily standing tasks + focus-hours capacity-aware suggestions
 * Modeled on: e2e/task-suggestion.spec.ts, e2e/session-kickoff.spec.ts
 * Spec role: risk proof (capacity rationale, standing pool exclusion, standing UX)
 */
import { expect, test } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import {
	createTaskViaApi,
	markStandingComplete,
	seedCapacitySuggestionScenario,
} from "./helpers/daily-plan";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	completeKickoffReadiness,
	dismissKickoffSteeringIfVisible,
	expectKickoffVisible,
	waitForKickoffSuggestionResponse,
} from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	expectSuggestionVisible,
	waitForSuggestionNext,
} from "./helpers/suggestion";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import {
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

test.describe("Daily standing + focus capacity (S-27)", () => {
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
		await dismissFirstRunIfVisible(page);
		await ensureIdleCycle(page);
	});

	test("post-check-in suggests capacity-fit standing task with rationale", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const standingTitle = `E2E Standing ${ts}`;
		const longTitle = `E2E Long ${ts}`;

		await seedCapacitySuggestionScenario(page, {
			standingTitle,
			longTaskTitle: longTitle,
			remainingMinutes: 30,
		});

		const taskListReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await taskListReload;
		await dismissFirstRunIfVisible(page);
		await dismissKickoffSteeringIfVisible(page);

		await focusTask(page, longTitle);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "fading");
		await suggestionResponse;

		await expectSuggestionVisible(page, {
			title: standingTitle,
		});

		const rationaleToggle = page.getByTestId("suggestion-rationale-toggle");
		if (await rationaleToggle.isVisible()) {
			await rationaleToggle.click();
			await expect(
				page.getByTestId("suggestion-rationale-expander"),
			).toContainText(/min left today/i);
		} else {
			await expect(page.getByTestId("task-suggestion-card")).toContainText(
				/min left today/i,
			);
		}
	});

	test("completed daily standing task is excluded from kickoff suggestions", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const standingTitle = `E2E Done Today ${ts}`;
		const activeTitle = `E2E Active ${ts}`;

		await seedCapacitySuggestionScenario(page, {
			standingTitle,
			longTaskTitle: activeTitle,
			remainingMinutes: 120,
			standingEffortMinutes: 25,
			longEffortMinutes: 60,
		});

		const taskListReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await taskListReload;
		await dismissFirstRunIfVisible(page);
		await dismissKickoffSteeringIfVisible(page);

		await markStandingComplete(page, standingTitle);
		await expect(
			page
				.getByRole("listitem")
				.filter({ hasText: standingTitle })
				.first()
				.getByTestId("daily-standing-badge"),
		).toBeVisible();

		const reloadAfterDone = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		const kickoffSettled = waitForKickoffSuggestionResponse(page);
		await page.reload();
		await reloadAfterDone;
		await dismissFirstRunIfVisible(page);
		await completeKickoffReadiness(page, "skip");
		await kickoffSettled;

		await expectKickoffVisible(page, { title: activeTitle });
		await expect(
			page
				.getByTestId("suggestion-task-title")
				.filter({ hasText: standingTitle }),
		).toHaveCount(0);
	});

	test("standing task shows badge, done-for-today, and focus budget prompt @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const standingTitle = `E2E Standing UX ${ts}`;

		await createTaskViaApi(page, {
			title: standingTitle,
			workType: "OPERATIONAL",
			isDailyStanding: true,
		});

		await page.goto("/tasks");
		await expect(page.getByTestId("task-list")).toBeVisible({
			timeout: 15_000,
		});
		await dismissFirstRunIfVisible(page);
		await dismissKickoffSteeringIfVisible(page);

		const standingRow = page
			.getByRole("listitem")
			.filter({ hasText: standingTitle })
			.first();
		await expect(standingRow.getByTestId("daily-standing-badge")).toBeVisible();
		await expect(standingRow.getByTestId("task-complete-button")).toBeVisible();

		await expect(page.getByTestId("focus-budget-prompt")).toBeVisible();
		await page.getByTestId("focus-budget-preset-120").click();
		await expect(page.getByTestId("focus-budget-prompt")).toBeHidden({
			timeout: 10_000,
		});
	});
});
