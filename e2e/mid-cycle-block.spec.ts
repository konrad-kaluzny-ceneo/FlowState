/**
 * E2E: Mid-cycle block → break hand-off (S-51 Phase 4).
 * Proves: blocking the focused task during a running WORK cycle ends the cycle
 * into check-in → break-choice → break, and the task shows blocked afterward.
 *
 * Per L-06: <15s, hook-first; this is the single belt e2e proving the headline flow.
 * Per fake-clock lesson: no fake clock — we never advance time; the block action is
 * a direct click, not timer-dispatched.
 */
import { expect, test } from "./fixtures";
import { chooseBreakKind } from "./helpers/break-choice";
import { completeCheckIn } from "./helpers/check-in";
import { dismissKickoffReadinessIfVisible } from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { expectShortBreakPhaseVisible } from "./helpers/timer-phase";
import { forgetFakeClock, startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Mid-cycle block → break (S-51)", () => {
	test.beforeEach(async ({ page }) => {
		forgetFakeClock(page);
		await resetWorkerSessionViaApi(page);
		await page.goto("/focus");
		await expectFocusPageReady(page);
	});

	test.afterEach(async ({ page }) => {
		forgetFakeClock(page);
		await resetWorkerSessionViaApi(page);
	});

	test("blocking focused task mid-cycle enters check-in then break", async ({
		page,
	}) => {
		const taskTitle = `E2E Block Mid ${Date.now()}`;

		// Start a long work cycle (90 min) without fake clock — we never advance time
		await startFocusedWorkCycle(page, taskTitle, 5400, { fakeClock: false });

		// The block button should be visible on the running timer panel
		const blockBtn = page.getByTestId("focus-block-focused-task");
		await expect(blockBtn).toBeVisible({ timeout: 5_000 });

		// Block the focused task
		await blockBtn.click();

		// Authenticated path: check-in overlay appears
		await dismissKickoffReadinessIfVisible(page);
		await completeCheckIn(page, "steady");

		// Break-choice overlay appears
		await chooseBreakKind(page, "short");

		// Break is now running
		await expectShortBreakPhaseVisible(page);
	});
});
