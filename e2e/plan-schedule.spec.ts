/**
 * Risk: S-54 / US-08 — Plan dnia day schedule timeline visibility
 * Modeled on: e2e/seed.spec.ts, e2e/daily-standing-capacity.spec.ts
 * Spec role: belt smoke — auth worker opens /plan, seeded block chip visible
 */
import { expect, test } from "./fixtures";
import {
	getBrowserLocalDateKey,
	seedScheduleBlockViaApi,
} from "./helpers/daily-plan";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";

test.describe("Plan dnia schedule timeline (S-54)", () => {
	test("authenticated plan page shows seeded schedule block", async ({
		page,
	}) => {
		test.setTimeout(45_000);

		await page.goto("/plan");
		await dismissFirstRunIfVisible(page);

		const localDateKey = await getBrowserLocalDateKey(page);
		expect(localDateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);

		const block = await seedScheduleBlockViaApi(page, {
			startMinute: 540,
			durationMinutes: 30,
			blockType: "FOCUS",
		});

		await page.reload();
		await expect(page.getByTestId("schedule-timeline")).toBeVisible({
			timeout: 20_000,
		});
		const chip = page.getByTestId(`schedule-block-${block.id}`);
		await expect(chip).toBeVisible();
		await expect(chip).toHaveAttribute("aria-label", /09:00–09:30/);
	});
});
