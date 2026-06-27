/**
 * E2E generation exemplar — model every new spec on this file + e2e/fixtures.ts helpers.
 * Critical risks (test-plan §2, §6.3): #3 mid-cycle prompt, #7 check-in gate.
 * Risk #1 auth reload: hook + integration (see test-plan §6.2); guest reload in guest-trial.spec.ts.
 * Anti-patterns avoided: UI login, waitForTimeout, CSS/XPath locators, shared storageState.
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import {
	dismissKickoffReadinessIfVisible,
	ensureIdleCycle,
} from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	expectShortBreakPhaseHidden,
	expectShortBreakPhaseVisible,
} from "./helpers/timer-phase";
import {
	addTasks,
	advanceClockThroughFastWork,
	forgetFakeClock,
	markTaskCompleteMidCycle,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
	forgetFakeClock(page);
	// API reset before navigation — avoid hydrating a stale RUNNING cycle (R3 → R7).
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
	await ensureIdleCycle(page);
});

test.afterEach(async ({ page }) => {
	forgetFakeClock(page);
	await resetWorkerSessionViaApi(page);
});

test.describe("Seed exemplar — Risk #3 mid-cycle prompt", () => {
	test("completing a task mid-cycle surfaces FR-015 choices", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const task1 = `Seed R3 A ${ts}`;
		const task2 = `Seed R3 B ${ts}`;

		await addTasks(page, [task1, task2]);
		await startFocusedWorkCycle(page, task1, 30);
		await markTaskCompleteMidCycle(page, task1);

		await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Continue with selected task" }),
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "End cycle and break" }),
		).toBeVisible();
	});
});

test.describe("Seed exemplar — Risk #7 check-in gate", () => {
	test("work cycle end blocks break until energy check-in completes", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Seed R7 ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await dismissKickoffReadinessIfVisible(page);
		await page.getByRole("button", { name: "Continue later" }).click();

		await expectShortBreakPhaseHidden(page);
		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
		await completeCheckIn(page, "steady");
		await expectShortBreakPhaseVisible(page);
	});
});
