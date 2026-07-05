/**
 * Risk: S-17 / FR-040 — session closure overlay on explicit session end
 * Modeled on: e2e/pomodoro-cycle.spec.ts
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Session closure (S-17)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/focus");
		await expectFocusPageReady(page);
		await waitForCycleGetActive(page);
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

	test("end session shows dismissible closure overlay", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Closure ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 30);

		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		await expect(page.getByTestId("end-session-btn")).toBeEnabled({
			timeout: 15_000,
		});

		await page.getByTestId("end-session-btn").click();

		await expect(page.getByTestId("end-session-confirm-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByTestId("end-session-confirm-description"),
		).toBeVisible();
		await page.getByTestId("end-session-confirm-btn").click();

		await expect(page.getByTestId("session-closure-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("session-closure-line")).toContainText(
			"Session complete",
		);
		await expect(page.getByTestId("session-closure-line")).toContainText(
			"wasn't counted",
		);

		await page.getByTestId("session-closure-dismiss-btn").click();
		await expect(page.getByTestId("session-closure-overlay")).toBeHidden();
		await expect(page.getByTestId("session-energy-card")).toHaveCount(0);
		await expect(page.getByTestId("end-session-btn")).toBeHidden();
	});

	test("pause and end session freezes timer then closes session", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E PauseEnd ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 30);

		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		await expect(page.getByTestId("pause-and-end-session-btn")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("pause-and-end-session-btn").click();

		await expect(page.getByTestId("timer-panel-paused")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("end-session-confirm-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByTestId("end-session-confirm-cancel-btn"),
		).toBeVisible();
		await expect(
			page.getByTestId("end-session-confirm-description"),
		).toBeVisible();
		await page.getByTestId("end-session-confirm-btn").click();

		await expect(page.getByTestId("session-closure-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("session-closure-line")).toContainText(
			"wasn't counted",
		);
		await page.getByTestId("session-closure-dismiss-btn").click();
		await expect(page.getByTestId("end-session-btn")).toBeHidden();
	});
});
