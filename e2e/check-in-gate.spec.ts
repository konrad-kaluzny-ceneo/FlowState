import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	advanceClockThroughFastWork,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Check-in gate (Risk #7)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
	});

	test("gate blocks break until energy selected; persists check-in", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `Check-in gate ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();

		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
		await expect(page.getByText("Short Break")).toBeHidden();

		await completeCheckIn(page, "steady");

		await expect(page.getByRole("alert")).toBeHidden();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(page.getByText("Short Break")).toBeVisible();
	});
});
