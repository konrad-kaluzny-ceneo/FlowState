/**
 * Risk: #1 — guest local trial task and timer survive page reload
 * Modeled on: e2e/seed.spec.ts
 * Spec role: risk proof
 */
import { expect, test } from "@playwright/test";

import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Guest trial (S-08)", () => {
	test("guest task persists locally and survives refresh", async ({
		page,
		context,
	}) => {
		await context.clearCookies();

		test.setTimeout(60_000);

		const taskTitle = `Guest E2E ${Date.now()}`;

		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("task-list")).toBeVisible();
		await dismissFirstRunIfVisible(page);

		await startFocusedWorkCycle(page, taskTitle, 30);

		await page.reload();
		// Guest recovery is localStorage-driven; UI oracles are enough (no reliable cycle.getActive on reload).
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 20_000,
		});
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }).first(),
		).toBeVisible();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
	});
});
