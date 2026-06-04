import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";

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

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();
		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();

		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

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
