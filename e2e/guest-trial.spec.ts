import { expect, test } from "@playwright/test";

import {
	E2E_FAST_WORK_PRESET_LABEL,
	startFocusedWorkCycle,
} from "./helpers/fast-cycle";

test.describe("Guest trial (S-08)", () => {
	test("guest task persists locally and survives refresh", async ({
		page,
		context,
	}) => {
		await context.clearCookies();

		test.setTimeout(60_000);

		const taskTitle = `Guest E2E ${Date.now()}`;

		await page.goto("/");
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("task-list")).toBeVisible();

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();

		await startFocusedWorkCycle(page, taskTitle, E2E_FAST_WORK_PRESET_LABEL);

		await page.reload();
		// Guest recovery is localStorage-driven; UI oracles are enough (no reliable cycle.getActive on reload).
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
	});
});
