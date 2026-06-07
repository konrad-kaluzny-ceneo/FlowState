/**
 * E2E generation exemplar — model every new spec on this file + e2e/fixtures.ts helpers.
 * Critical risks (test-plan §2, §6.3): #1 persistence reload, #3 mid-cycle prompt, #7 check-in gate.
 * Anti-patterns avoided: UI login, waitForTimeout, CSS/XPath locators, shared storageState.
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	addTasks,
	advanceClockThroughFastWork,
	markTaskCompleteMidCycle,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Seed exemplar — Risk #1 persistence reload", () => {
	test("authenticated mid-cycle reload preserves task and running panel", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);

		const taskTitle = `E2E Seed R1 ${Date.now()}`;

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

test.describe("Seed exemplar — Risk #3 mid-cycle prompt", () => {
	test("completing a task mid-cycle surfaces FR-015 choices", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);

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

		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);

		const taskTitle = `E2E Seed R7 ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();

		await expect(page.getByText("Short Break")).toBeHidden();
		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
		await completeCheckIn(page, "steady");
		await expect(page.getByText("Short Break")).toBeVisible();
	});
});
