import { expect, test, waitForCycleGetActive } from "./fixtures";
import {
	advanceClockThroughFastWork,
	E2E_FAST_WORK_PRESET_LABEL,
	startFocusedWorkCycle,
} from "./helpers/fast-cycle";
import { ensureIdleCycle } from "./helpers/idle-cycle";

test.describe("Pomodoro cycle (S-01)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
	});

	test("focus, start, complete via clock, continue later", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Pomodoro ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, E2E_FAST_WORK_PRESET_LABEL);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("button", { name: "Continue later" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Continue later" }).click();

		await expect(page.getByTestId("cycle-complete-overlay")).not.toBeVisible();
		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await expect(taskRow.getByRole("button", { name: "Focus" })).toBeVisible();
	});

	test("mark task done from completion overlay", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Done ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, E2E_FAST_WORK_PRESET_LABEL);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		const markDone = page.getByRole("button", {
			name: "Done — mark task complete",
		});
		await expect(markDone).toBeEnabled();
		await markDone.click();

		await expect(page.getByTestId("cycle-complete-overlay")).not.toBeVisible();
		await expect(page.getByRole("heading", { name: /Completed/ })).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toHaveCount(1);
	});
});
