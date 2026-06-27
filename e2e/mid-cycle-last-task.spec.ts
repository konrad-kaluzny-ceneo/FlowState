/**
 * Risk: #3 — last active task mid-cycle shows only end-break option (no continue)
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { completeKickoffReadiness } from "./helpers/kickoff";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	expectShortBreakPhaseHidden,
	expectShortBreakPhaseVisible,
} from "./helpers/timer-phase";
import {
	markTaskCompleteMidCycle,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Mid-cycle last task (Risk #3)", () => {
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
		await resetCycleRecoveryAfterReload(page);
		if (await page.getByTestId("session-energy-card").isVisible()) {
			await completeKickoffReadiness(page, "skip");
		}
	});

	test("only end-break option when no other active tasks", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `Solo mid ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 30);
		await markTaskCompleteMidCycle(page, taskTitle);

		await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeVisible();
		await expect(page.getByTestId("mid-cycle-continue-btn")).toBeHidden();
		await expect(page.getByTestId("mid-cycle-end-break-btn")).toBeVisible();

		await page.getByTestId("mid-cycle-end-break-btn").click();
		await expectShortBreakPhaseHidden(page);
		await completeCheckIn(page, "steady");
		await expectShortBreakPhaseVisible(page);
	});
});
