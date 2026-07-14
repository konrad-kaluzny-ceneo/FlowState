/**
 * Risk: S-17 / FR-040 — session closure overlay on explicit session end
 * Modeled on: e2e/pomodoro-cycle.spec.ts
 */
import { expect, test } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Session closure (S-17)", () => {
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

	// Real clock: pause dispatches its mutation from a timer callback, which a frozen (fake)
	// clock never fires — so this journey must not install one. It never advances time; the
	// long 600s cycle simply keeps the cycle from expiring mid-test.
	//
	// Scope is deliberately narrow: prove in a real browser that ⏸ actually pauses, and that
	// ending stays reachable while paused (the two-tap journey's premise). Driving the whole
	// end→confirm→closure chain here as well made the test slow (>35s) and flaky; that chain
	// is already covered by the standalone closure test above, and the after-pause confirm
	// copy by pomodoro-dashboard.test.tsx. See lessons.md L-06.
	test("pause via timer pauses the running cycle", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Pause ${Date.now()}`;
		// Pause needs the *persisted* cycle id, and the optimistic start renders "running"
		// before the create settles — so wait for it to land before pausing.
		const cycleCreated = page.waitForResponse(
			(response) =>
				response.url().includes("cycle.create") &&
				response.request().method() === "POST" &&
				response.ok(),
			{ timeout: 20_000 },
		);
		await startFocusedWorkCycle(page, taskTitle, 600, { fakeClock: false });
		await cycleCreated;

		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		await expect(page.getByTestId("timer-pause")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("timer-pause").click();

		// The pause actually took effect: the panel flips to paused and offers resume.
		await expect(page.getByTestId("timer-panel-paused")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("timer-resume")).toBeVisible();

		// Second step of the two-tap journey stays available while paused.
		await expect(page.getByTestId("end-session-btn")).toBeEnabled({
			timeout: 15_000,
		});
	});
});
