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

	// App shell carries the brand link
	await expect(
		page.getByRole("link", { name: "FlowState" }).first(),
	).toBeVisible();

	// Focus page is ready (workbench grid mounted)
	await expectFocusPageReady(page);
});
