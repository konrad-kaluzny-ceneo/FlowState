/**
 * Risk: (none — infra smoke)
 * Modeled on: e2e/seed.spec.ts
 * Spec role: infra smoke — proves fixture auth + app shell load
 */
import { expect, test } from "./fixtures";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import { expectFocusPageReady } from "./helpers/task-list-locator";

test("authenticated user sees app shell with task list", async ({ page }) => {
	await page.goto("/");
	await clearOnboardingKeys(page);
	await dismissFirstRunIfVisible(page);

	// App shell carries the brand in the sidebar (desktop) or mobile header
	await expect(
		page.getByTestId("app-sidebar").or(page.getByTestId("app-mobile-header")),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "FlowState" })).toBeVisible();

	// Focus page is ready (timer panel mounted)
	await expectFocusPageReady(page);
});
