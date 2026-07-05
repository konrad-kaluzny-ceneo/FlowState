/**
 * F-06 — axe accessibility scans on authenticated wedge surfaces.
 * Runs outside the belt via `pnpm test:e2e:a11y` (CI step after belt).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";

test.describe("Accessibility — wedge surfaces", () => {
	test.beforeEach(async ({ page }) => {
		await resetWorkerSessionViaApi(page);
		await page.goto("/tasks");
		await expect(page.getByTestId("task-list")).toBeVisible({
			timeout: 15_000,
		});
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
