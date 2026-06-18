/**
 * Risk: test-plan §2 #10 — pause/resume preserves remaining time; wedge gates suppressed while PAUSED (S-24 / US-04)
 * Modeled on: e2e/seed.spec.ts, e2e/pomodoro-cycle.spec.ts
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Cycle pause and resume (S-24)", () => {
	test.beforeEach(async ({ page }) => {
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

	test("pause freezes countdown, resume continues, no wedge overlays while paused", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E Pause ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 60);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(page.getByTestId("timer-pause")).toBeVisible();

		const pauseSettled = page.waitForResponse(
			(response) =>
				response.url().includes("cycle.pause") &&
				response.request().method() === "POST" &&
				response.ok(),
			{ timeout: 15_000 },
		);
		await page.getByTestId("timer-pause").click();
		await pauseSettled;
		await expect(page.getByTestId("timer-panel-paused")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("timer-resume")).toBeVisible();
		await expect(page.getByTestId("check-in-overlay")).not.toBeVisible();
		await expect(page.getByTestId("task-suggestion-card")).not.toBeVisible();

		const pausedCountdownA = await page
			.getByTestId("timer-countdown")
			.textContent();
		await expect
			.poll(async () => page.getByTestId("timer-countdown").textContent(), {
				timeout: 3_000,
			})
			.toBe(pausedCountdownA);

		const resumeSettled = page.waitForResponse(
			(response) =>
				response.url().includes("cycle.resume") &&
				response.request().method() === "POST" &&
				response.ok(),
			{ timeout: 15_000 },
		);
		await page.getByTestId("timer-resume").click();
		await resumeSettled;
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		const countdownAfterResume = await page
			.getByTestId("timer-countdown")
			.textContent();
		expect(countdownAfterResume).toBe(pausedCountdownA);

		await expect(page.getByTestId("timer-interrupt")).toBeVisible();
	});
});
