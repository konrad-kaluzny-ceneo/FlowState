/**
 * Risk: #5 — guest trial tasks survive sign-in merge into account (S-08)
 * Modeled on: e2e/seed.spec.ts, e2e/guest-trial.spec.ts
 * Spec role: risk proof — crosses guest localStorage → auth session → server import → tRPC list
 */
import { expect, test } from "@playwright/test";
import {
	dismissFirstRunIfVisible,
	dismissMergeSuccessIfVisible,
} from "./helpers/onboarding";
import { expectTaskListVisible } from "./helpers/task-list-locator";
import { createTestUser, signInAsUser } from "./helpers/user";
import { addTask } from "./helpers/work-cycle";

const GUEST_STORAGE_KEY = "flowstate:guest-v1";

test.describe("Guest merge on sign-in (S-08 / Risk #5)", () => {
	test("guest tasks import into account after sign-in without losing data", async ({
		page,
		context,
		request,
	}) => {
		await context.clearCookies();

		test.setTimeout(90_000);

		const taskTitle = `Guest Merge ${Date.now()}`;

		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expectTaskListVisible(page);
		await dismissFirstRunIfVisible(page);

		await addTask(page, taskTitle);

		const hasGuestBlob = await page.evaluate(
			(key) => localStorage.getItem(key) != null,
			GUEST_STORAGE_KEY,
		);
		expect(hasGuestBlob).toBe(true);

		const user = await createTestUser(request);
		const authState = await signInAsUser(request, user);
		await context.addCookies(authState.cookies);

		await page.goto("/");

		await dismissMergeSuccessIfVisible(page, { appearTimeoutMs: 30_000 });

		await expect(page.getByTestId("guest-banner")).toBeHidden({
			timeout: 30_000,
		});
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }).first(),
		).toBeVisible({ timeout: 30_000 });

		const guestBlobCleared = await page.evaluate(
			(key) => localStorage.getItem(key),
			GUEST_STORAGE_KEY,
		);
		expect(guestBlobCleared).toBeNull();
	});
});
