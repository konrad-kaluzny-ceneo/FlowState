/**
 * Risk: #5 — guest active work cycle imports and resumes after sign-in (S-08)
 * Modeled on: e2e/guest-merge-on-sign-in.spec.ts, e2e/guest-trial.spec.ts
 * Spec role: risk proof — guest localStorage cycle → auth → server import → running timer
 */
import { expect, test } from "@playwright/test";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { createTestUser, signInAsUser } from "./helpers/user";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

const GUEST_STORAGE_KEY = "flowstate:guest-v1";

test.describe("Guest merge cycle on sign-in (S-08 / Risk #5)", () => {
	test("guest active work cycle resumes on account after sign-in", async ({
		page,
		context,
		request,
	}) => {
		await context.clearCookies();

		test.setTimeout(90_000);

		const taskTitle = `Guest Cycle Merge ${Date.now()}`;

		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("task-list")).toBeVisible();
		await dismissFirstRunIfVisible(page);

		await startFocusedWorkCycle(page, taskTitle, 30);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		const hasGuestBlob = await page.evaluate(
			(key) => localStorage.getItem(key) != null,
			GUEST_STORAGE_KEY,
		);
		expect(hasGuestBlob).toBe(true);

		const user = await createTestUser(request);
		const authState = await signInAsUser(request, user);
		await context.addCookies(authState.cookies);

		const getActiveAfterMerge = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 30_000 },
		);
		await page.goto("/");
		await getActiveAfterMerge;
		await dismissFirstRunIfVisible(page);

		await expect(page.getByTestId("guest-banner")).toBeHidden({
			timeout: 30_000,
		});
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }).first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 30_000,
		});

		const guestBlobCleared = await page.evaluate(
			(key) => localStorage.getItem(key),
			GUEST_STORAGE_KEY,
		);
		expect(guestBlobCleared).toBeNull();
	});
});
