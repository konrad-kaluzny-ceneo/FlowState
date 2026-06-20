/**
 * Risk: S-30 / US-03 — daily work timing recap + focus footprint
 * Modeled on: e2e/seed.spec.ts, e2e/daily-standing-capacity.spec.ts
 * Spec role: recap panel visibility, dismiss, footprint on focused row
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { dismissKickoffSteeringIfVisible } from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
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
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
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
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		await advanceClockThroughFastWork(page);
		const recapResponse = page.waitForResponse(
			(response) => response.url().includes("recap.getDaily") && response.ok(),
			{ timeout: 20_000 },
		);
		await completeWorkCycleWithCheckIn(page, "steady");
		await recapResponse;

		await expect(page.getByTestId("daily-recap-panel")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("daily-recap-last24")).toContainText(
			taskTitle,
		);

		await expect(
			page.locator('[data-testid^="task-footprint-"]'),
		).toContainText(/m total/i);

		await page.getByTestId("daily-recap-dismiss").click();
		await expect(page.getByTestId("daily-recap-panel")).toBeHidden();
	});
});
