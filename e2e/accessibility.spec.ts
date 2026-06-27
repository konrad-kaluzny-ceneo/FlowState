/**
 * F-06 — axe accessibility scans on authenticated wedge surfaces.
 * Runs outside the belt via `pnpm test:e2e:a11y` (CI step after belt).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectTaskListVisible } from "./helpers/task-list-locator";

test.describe("Accessibility — wedge surfaces", () => {
	test.beforeEach(async ({ page }) => {
		await resetWorkerSessionViaApi(page);
		await page.goto("/");
		await expectTaskListVisible(page);
		await waitForCycleGetActive(page);
	});

	test("home task list has no critical or serious axe violations", async ({
		page,
	}) => {
		const results = await new AxeBuilder({ page })
			.include('[data-testid="task-list"]')
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();

		const blocking = results.violations.filter(
			(violation) =>
				violation.impact === "critical" || violation.impact === "serious",
		);

		expect(blocking).toEqual([]);
	});
});
