/**
 * Risk: S-22 / FR-013 — guest catch-up on hidden work expiry without wedge gates
 * Modeled on: e2e/guest-first-run.spec.ts, e2e/background-tab-return.spec.ts
 * Spec role: risk proof (guest-chromium project)
 */
import { expect, test } from "@playwright/test";

import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { runWhileHidden } from "./helpers/visibility";
import {
	FAST_WORK_CLOCK_MS,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Guest background tab return catch-up (S-22)", () => {
	test.beforeEach(async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/");
		await dismissFirstRunIfVisible(page);
	});

	test("guest hidden work expiry shows catch-up without check-in gate", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `Guest Catch-up ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await page.clock.install();
		await runWhileHidden(page, async () => {
			await page.clock.runFor(FAST_WORK_CLOCK_MS);
		});

		const catchUp = page.getByTestId("tab-return-catchup");
		await expect(catchUp).toBeVisible({ timeout: 15_000 });
		await expect(catchUp).toContainText(taskTitle);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible();

		await page.getByRole("button", { name: "Continue later" }).click();
		await expect(catchUp).toBeHidden();
		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
	});
});
