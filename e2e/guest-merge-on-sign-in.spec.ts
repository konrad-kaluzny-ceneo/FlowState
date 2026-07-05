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

		// S-41 moves the guest sign-in CTA into the desktop context rail and hides
		// the header GuestBanner at lg. Drive this guest-merge flow at mobile width
		// so the header banner remains the guest-mode oracle.
		await page.setViewportSize({ width: 390, height: 844 });

		const taskTitle = `Guest Merge ${Date.now()}`;

		// Verify guest mode on focus page (banner visible at mobile width)
		await page.goto("/focus");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 15_000,
		});
		await dismissFirstRunIfVisible(page);

		// Add task on /tasks
		await addTask(page, taskTitle);

		const hasGuestBlob = await page.evaluate(
			(key) => localStorage.getItem(key) != null,
			GUEST_STORAGE_KEY,
		);
		expect(hasGuestBlob).toBe(true);

		const user = await createTestUser(request);
		const authState = await signInAsUser(request, user);
		await context.addCookies(authState.cookies);

		// After sign-in, navigate to /focus to check merge success and guest banner hidden
		await page.goto("/focus");
		await dismissMergeSuccessIfVisible(page, { appearTimeoutMs: 30_000 });
		await expect(page.getByTestId("guest-banner")).toBeHidden({
			timeout: 30_000,
		});

		// Verify task persists on /tasks after merge
		await page.goto("/tasks");
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
