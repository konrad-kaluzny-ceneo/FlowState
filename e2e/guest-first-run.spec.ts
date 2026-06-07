/**
 * Risk: S-11 / FR-003b — guest first-run copy, no wedge coaches
 * Modeled on: e2e/seed.spec.ts, e2e/guest-trial.spec.ts
 * Spec role: risk proof (guest-chromium project)
 */
import { expect, test } from "@playwright/test";

import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
	getOnboardingStateFromStorage,
	ONBOARDING_KEY_GUEST,
} from "./helpers/onboarding";
import { startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Guest first-run onboarding (S-11)", () => {
	test.beforeEach(async ({ page, context }) => {
		await context.clearCookies();
		await page.goto("/");
		await clearOnboardingKeys(page);
		await page.reload();
	});

	test("shows guest-specific first-run copy", async ({ page }) => {
		test.setTimeout(60_000);

		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("first-run-overlay")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Welcome to FlowState" }),
		).toBeVisible();
		await expect(
			page.getByText(
				/sign in to unlock energy check-ins and smart task suggestions/i,
			),
		).toBeVisible();
		await expect(page.getByText(/Your wedge workflow/i)).toBeHidden();
	});

	test("dismiss persists on reload", async ({ page }) => {
		test.setTimeout(60_000);

		await expect(page.getByTestId("first-run-overlay")).toBeVisible();
		await page.getByTestId("first-run-dismiss-btn").click();
		await expect(page.getByTestId("first-run-overlay")).toBeHidden();

		const stateAfterDismiss = await getOnboardingStateFromStorage(
			page,
			ONBOARDING_KEY_GUEST,
		);
		expect(stateAfterDismiss?.firstRunDismissed).toBe(true);

		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByTestId("first-run-overlay")).toBeHidden();
	});

	test("guest work cycle has no wedge coach lines", async ({ page }) => {
		test.setTimeout(60_000);

		await dismissFirstRunIfVisible(page);

		const taskTitle = `Guest Coach E2E ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 30);

		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
		await expect(page.getByTestId("check-in-coach-line")).toBeHidden();
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();
		await expect(page.getByTestId("suggestion-coach-line")).toBeHidden();
	});
});
