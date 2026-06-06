import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	markTaskCompleteMidCycle,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Mid-cycle last task (Risk #3)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
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
		await expect(page.getByText("Short Break")).toBeVisible();
	});
});
