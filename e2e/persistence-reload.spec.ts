import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Persistence reload (Risk #1)", () => {
	test("authenticated mid-cycle reload preserves task and running panel", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);

		const taskTitle = `E2E Reload ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 30);

		const getActiveAfterReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await getActiveAfterReload;

		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
	});
});
