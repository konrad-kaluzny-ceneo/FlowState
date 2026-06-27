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
import { expectTaskListVisible } from "./helpers/task-list-locator";

test("authenticated user sees app shell with task list", async ({ page }) => {
	await page.goto("/");
	await clearOnboardingKeys(page);
	await dismissFirstRunIfVisible(page);

	// App heading is visible
	await expect(page.getByRole("heading", { name: "FlowState" })).toBeVisible();

	// Task list container rendered (proves TaskList component loaded)
	await expectTaskListVisible(page);
});
