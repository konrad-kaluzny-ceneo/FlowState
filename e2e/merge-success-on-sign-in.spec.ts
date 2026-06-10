/**
 * Risk: FR-003c / S-11 — merge-success modal appears before first-run after guest sign-in
 * Modeled on: e2e/guest-merge-on-sign-in.spec.ts
 * Spec role: risk proof — merge-success wins overlay stack; first-run deferred until Continue
 */
import { expect, test } from "@playwright/test";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import { createTestUser, signInAsUser } from "./helpers/user";
import { addTask } from "./helpers/work-cycle";

test.describe("Merge-success ordering on sign-in (FR-003c / S-11)", () => {
	test("merge-success modal blocks first-run until dismissed @skip-belt", async ({
		page,
		context,
		request,
	}) => {
		await context.clearCookies();

		test.setTimeout(90_000);

		const ts = Date.now();
		const taskOne = `Merge Order A ${ts}`;
		const taskTwo = `Merge Order B ${ts}`;

		// Setup: clear onboarding keys so auth first-run is eligible after merge dismiss
		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await clearOnboardingKeys(page);
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("task-list")).toBeVisible();
		await dismissFirstRunIfVisible(page);

		await addTask(page, taskOne);
		await addTask(page, taskTwo);

		const user = await createTestUser(request);
		const authState = await signInAsUser(request, user);
		await context.addCookies(authState.cookies);

		await page.goto("/");

		// Merge-success wins overlay stack; first-run stays hidden while modal is open
		await expect(async () => {
			await expect(page.getByTestId("merge-success-overlay")).toBeVisible();
			await expect(page.getByTestId("first-run-overlay")).toBeHidden();
		}).toPass({ timeout: 30_000 });

		const mergeOverlay = page.getByTestId("merge-success-overlay");
		await expect(
			mergeOverlay.getByRole("heading", { name: "Your trial work is saved" }),
		).toBeVisible();
		await expect(mergeOverlay.getByText("Imported 2 tasks.")).toBeVisible();
		await expect(mergeOverlay.getByText(taskOne)).toBeVisible();
		await expect(mergeOverlay.getByText(taskTwo)).toBeVisible();

		await page.getByTestId("merge-success-dismiss-btn").click();
		await expect(page.getByTestId("merge-success-overlay")).toBeHidden();

		await expect(page.getByTestId("first-run-overlay")).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.getByRole("heading", { name: "Your wedge workflow" }),
		).toBeVisible();
	});
});
