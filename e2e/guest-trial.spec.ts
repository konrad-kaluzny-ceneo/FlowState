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

		// S-41 moves the guest sign-in CTA into the desktop context rail and hides
		// the header GuestBanner at lg. Drive this guest-trial flow at mobile width
		// so the header banner remains the guest-mode oracle.
		await page.setViewportSize({ width: 390, height: 844 });

		const taskTitle = `Guest E2E ${Date.now()}`;

		// Verify guest mode on focus page (banner visible at mobile width)
		await page.goto("/focus");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 15_000,
		});
		await dismissFirstRunIfVisible(page);

		await startFocusedWorkCycle(page, taskTitle, 30);

		// After reload, verify the timer is running on /focus
		await page.goto("/focus");
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		// Verify the task persists on /tasks
		await page.goto("/tasks");
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }).first(),
		).toBeVisible({ timeout: 15_000 });
	});
});
