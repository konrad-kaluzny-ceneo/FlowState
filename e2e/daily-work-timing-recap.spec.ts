/**
 * Risk: S-30 / US-03 — daily work timing recap + focus footprint
 * Modeled on: e2e/seed.spec.ts, e2e/daily-standing-capacity.spec.ts
 * Spec role: recap panel visibility, dismiss, footprint on focused row
 */
import { expect, test } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { dismissKickoffSteeringIfVisible } from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import {
	addTasks,
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

test.describe.configure({ mode: "serial" });

test.describe("Daily work timing recap (S-30)", () => {
	test.beforeEach(async ({ page }) => {
		forgetFakeClock(page);
		await resetWorkerSessionViaApi(page);
		await page.goto("/focus");
		await expectFocusPageReady(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await resetFakeClock(page);
		await dismissFirstRunIfVisible(page);
		await dismissKickoffSteeringIfVisible(page);
		await ensureIdleCycle(page);
	});

	test("shows last 24h recap row after work cycle, dismiss hides panel, footprint on focus", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Recap ${Date.now()}`;
		await addTasks(page, [taskTitle]);
		await focusTask(page, taskTitle);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		await advanceClockThroughFastWork(page);
		const recapResponse = page.waitForResponse(
			(response) => response.url().includes("recap.getDaily") && response.ok(),
			{ timeout: 20_000 },
		);
		await completeWorkCycleWithCheckIn(page, "steady");
		await recapResponse;

		// S-41 renders the recap in two zones (secondary below lg, context rail at
		// lg) gated purely by CSS, so both copies live in the DOM at once. Scope to
		// the visible instance to avoid Playwright strict-mode violations.
		const visibleRecap = page.locator(
			'[data-testid="daily-recap-panel"]:visible',
		);
		await expect(visibleRecap).toBeVisible({
			timeout: 15_000,
		});
		// Recap sections default to collapsed (S-40 home IA reset); expand last 24h first.
		await visibleRecap.getByTestId("daily-recap-last24-toggle").click();
		await expect(visibleRecap.getByTestId("daily-recap-last24")).toContainText(
			taskTitle,
		);

		await expect(
			page.locator('[data-testid^="task-footprint-"]'),
		).toContainText(/m total/i);

		await visibleRecap.getByTestId("daily-recap-dismiss").click();
		await expect(
			page.locator('[data-testid="daily-recap-panel"]:visible'),
		).toHaveCount(0);
	});
});
