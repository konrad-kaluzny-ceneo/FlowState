import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	addTasks,
	markTaskCompleteMidCycle,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Mid-cycle completion (Risk #3)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
	});

	test("shows both choices when other active tasks remain", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const task1 = `Mid A ${ts}`;
		const task2 = `Mid B ${ts}`;

		await addTasks(page, [task1, task2]);
		await startFocusedWorkCycle(page, task1, 30);

		await markTaskCompleteMidCycle(page, task1);

		await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeVisible();
		await expect(page.getByTestId("mid-cycle-continue-btn")).toBeVisible();
		await expect(page.getByTestId("mid-cycle-end-break-btn")).toBeVisible();
	});

	test("continue keeps timer running and switches focus", async ({ page }) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const task1 = `Continue A ${ts}`;
		const task2 = `Continue B ${ts}`;

		await addTasks(page, [task1, task2]);
		await startFocusedWorkCycle(page, task1, 30);
		await markTaskCompleteMidCycle(page, task1);

		await page
			.getByTestId("mid-cycle-prompt-overlay")
			.getByRole("button", { name: task2 })
			.click();
		await page.getByTestId("mid-cycle-continue-btn").click();

		await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(
			page.getByTestId("timer-panel-running").getByText(task2),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Completed/ }),
		).toBeVisible();
	});

	test("end cycle and break starts short break", async ({ page }) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const task1 = `End break A ${ts}`;
		const task2 = `End break B ${ts}`;

		await addTasks(page, [task1, task2]);
		await startFocusedWorkCycle(page, task1, 30);
		await markTaskCompleteMidCycle(page, task1);
		await page.getByTestId("mid-cycle-end-break-btn").click();

		await expect(page.getByTestId("mid-cycle-prompt-overlay")).toBeHidden();
		await expect(page.getByText("Short Break")).toBeVisible();
	});
});
