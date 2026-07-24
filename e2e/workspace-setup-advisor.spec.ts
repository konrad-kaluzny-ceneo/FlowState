/**
 * Guest smoke: Settings Workspace checklist persists done state across reload.
 * Spec role: light persistence proof (L-06 — keep under ~15s).
 * Tag: @skip-belt — not part of the CI merge-gate subset.
 *
 * Uses Polish copy — guest default locale is `pl`.
 */
import { expect, test } from "@playwright/test";

import {
	dismissFirstRunIfVisible,
	seedOnboardingDismissed,
} from "./helpers/onboarding";

const TIP_ID = "email-batching";
const TIP_TITLE_PL = "Sprawdzaj pocztę partiami";

test.describe("Workspace setup advisor @skip-belt", () => {
	test("guest marks a tip done and it survives reload", async ({
		page,
		context,
	}) => {
		await context.clearCookies();
		test.setTimeout(45_000);

		await page.goto("/settings");
		await page.evaluate(() => localStorage.clear());
		await seedOnboardingDismissed(page);
		await page.reload();
		await dismissFirstRunIfVisible(page);

		await expect(page.getByTestId("ustawienia-view")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("settings-workspace-nudge")).toBeVisible();

		await page.getByTestId("settings-workspace-nudge-dismiss").click();
		await expect(page.getByTestId("settings-workspace-nudge")).toHaveCount(0);

		await page.getByTestId("settings-tab-workspace").click();
		await expect(page.getByTestId("settings-workspace-section")).toBeVisible();

		const tip = page.getByTestId(`workspace-tip-${TIP_ID}`);
		await expect(tip).toHaveAttribute("data-done", "false");

		await tip.getByRole("checkbox", { name: TIP_TITLE_PL }).check();
		await expect(tip).toHaveAttribute("data-done", "true");

		await page.reload();
		await expect(page.getByTestId("ustawienia-view")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("settings-workspace-nudge")).toHaveCount(0);

		await page.getByTestId("settings-tab-workspace").click();
		await expect(page.getByTestId(`workspace-tip-${TIP_ID}`)).toHaveAttribute(
			"data-done",
			"true",
		);
	});
});
