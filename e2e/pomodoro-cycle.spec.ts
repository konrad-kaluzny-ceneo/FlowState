/**
 * Risk: S-01 / #7 — pomodoro cycle completion overlay, check-in gate, task done flow
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (S-01 regression + check-in step)
 */

import { expect, test } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import {
	dismissKickoffReadinessIfVisible,
	ensureIdleCycle,
} from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { expectShortBreakPhaseHidden } from "./helpers/timer-phase";
import {
	advanceClockThroughFastBreak,
	advanceClockThroughFastWork,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

/** EN baseline — Session.transition.breakReentryFocused (belt runs in EN). */
const BREAK_REENTRY_FOCUSED = "Ready when you are — your focus is still here.";

test.describe("Pomodoro cycle (S-01)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		await page.goto("/focus");
		await expectFocusPageReady(page);
		await resetWorkerSessionViaApi(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await ensureIdleCycle(page);
	});

	test("focus, start, complete via clock, continue later", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Pomodoro ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("button", { name: "Continue later" }),
		).toBeVisible();

		await dismissKickoffReadinessIfVisible(page);
		await page.getByRole("button", { name: "Continue later" }).click();
		await expectShortBreakPhaseHidden(page);
		await completeCheckIn(page, "steady");
		// S-06: suggestion card may appear during break — no interaction required for S-01

		// Break may auto-complete since duration is 1s; dismiss the break overlay if it re-appears
		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			// This is the break-completion overlay — dismiss it
			const breakContinue = page
				.getByTestId("break-continue-suggested-btn")
				.or(page.getByTestId("break-continue-btn"));
			if (await breakContinue.isVisible().catch(() => false)) {
				await breakContinue.first().click();
			}
		}
		// Task list is now on /tasks — verify the task is still there
		await page.goto("/tasks");
		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await expect(taskRow.getByRole("button", { name: "Focus" })).toBeVisible();
	});

	test("break re-entry shows energy-keyed copy after focused check-in", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Reentry ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await dismissKickoffReadinessIfVisible(page);
		await page.getByRole("button", { name: "Continue later" }).click();
		await completeCheckIn(page, "focused");

		await advanceClockThroughFastBreak(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("break-reentry-copy")).toHaveText(
			BREAK_REENTRY_FOCUSED,
		);
	});
});
