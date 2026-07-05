/**
 * Risk: S-16 / FR-019–FR-021 — mindful session wind-down gate ordering
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof (fatigue trigger, end-session path)
 */

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
	rehydrateFatigueSeedState,
	resetCycleRecoveryAfterReload,
} from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	resetWorkerSessionViaApi,
	seedWindDownFatigueScenario,
} from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { expectShortBreakPhaseHidden } from "./helpers/timer-phase";
import {
	endSessionViaWindDown,
	expectWindDownVisible,
	submitFadingCheckInExpectingWindDown,
} from "./helpers/wind-down";
import {
	advanceClockThroughFastWork,
	ensureFakeClock,
	forgetFakeClock,
	resetFakeClock,
} from "./helpers/work-cycle";

async function seedFatigueAndAdvanceToWindDownGate(
	page: Page,
	taskTitle: string,
) {
	const seed = await seedWindDownFatigueScenario(page, taskTitle, 1);
	await ensureFakeClock(page);
	await rehydrateFatigueSeedState(page, seed.sessionId);
	await advanceClockThroughFastWork(page);
}

test.describe("Mindful session wind-down (S-16)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		forgetFakeClock(page);
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
		await ensureIdleCycle(page);
	});

	test("fatigue path triggers wind-down and blocks break until keep going", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E WindDown Fatigue ${Date.now()}`;

		await seedFatigueAndAdvanceToWindDownGate(page, taskTitle);
		await submitFadingCheckInExpectingWindDown(page);
		await expectWindDownVisible(page, {
			rationale: /energy dipping after 4 cycles/,
		});
		await expectShortBreakPhaseHidden(page);
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();
	});

	test("end session path ends session without break or suggestion", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E WindDown End ${Date.now()}`;

		await seedFatigueAndAdvanceToWindDownGate(page, taskTitle);
		await submitFadingCheckInExpectingWindDown(page);
		await endSessionViaWindDown(page);

		await expect(page.getByTestId("end-session-btn")).toBeHidden({
			timeout: 15_000,
		});
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();
		// Session closure overlay may appear after wind-down end — dismiss it
		const closureOverlay = page.getByTestId("session-closure-overlay");
		if (await closureOverlay.isVisible().catch(() => false)) {
			await page.getByTestId("session-closure-dismiss-btn").click();
			await expect(closureOverlay).toBeHidden({ timeout: 5_000 });
		}
		await expect(
			page
				.getByTestId("timer-panel-idle")
				.or(page.getByTestId("timer-panel-running"))
				.or(page.getByTestId("timer-panel-paused"))
				.or(page.getByTestId("home-workbench-grid")),
		).toBeVisible({ timeout: 15_000 });
	});
});
