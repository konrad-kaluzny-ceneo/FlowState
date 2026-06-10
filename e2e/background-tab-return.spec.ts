/**
 * Risk: S-22 / FR-013 — calm catch-up when work cycle ends while tab is hidden
 * Modeled on: e2e/pomodoro-cycle.spec.ts, e2e/seed.spec.ts
 * Spec role: risk proof — hidden expiry → catch-up banner → wedge to check-in
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { runWhileHidden } from "./helpers/visibility";
import {
	FAST_WORK_CLOCK_MS,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Background tab return catch-up (S-22)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
	});

	test("auth hidden work expiry shows catch-up then check-in wedge @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Catch-up ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await page.clock.install();
		await runWhileHidden(page, async () => {
			await page.clock.runFor(FAST_WORK_CLOCK_MS);
		});

		const catchUp = page.getByTestId("tab-return-catchup");
		await expect(catchUp).toBeVisible({ timeout: 15_000 });
		await expect(catchUp).toContainText(taskTitle);
		await expect(catchUp).toContainText(/just now|seconds ago|minute ago/i);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible();

		await page.getByRole("button", { name: "Continue later" }).click();
		await expect(catchUp).toBeHidden();
		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
	});
});
