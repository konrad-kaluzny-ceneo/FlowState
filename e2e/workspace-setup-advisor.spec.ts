/**
 * Guest smoke: Settings Workspace checklist persists done state across reload.
 * Spec role: light persistence proof (L-06 — keep under ~15s).
 * Tag: @skip-belt — not part of the CI merge-gate subset.
 */
import { expect, test } from "@playwright/test";

import messages from "../messages/en.json";
import {
	dismissFirstRunIfVisible,
	seedOnboardingDismissed,
} from "./helpers/onboarding";

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

		const tipTitle = messages.WorkspaceSetup.tips["email-batching"].title;
		const tip = page.getByTestId("workspace-tip-email-batching");
		await expect(tip).toHaveAttribute("data-done", "false");

		await tip.getByRole("checkbox", { name: tipTitle }).check();
		await expect(tip).toHaveAttribute("data-done", "true");

		await page.reload();
		await expect(page.getByTestId("ustawienia-view")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("settings-workspace-nudge")).toHaveCount(0);

		await page.getByTestId("settings-tab-workspace").click();
		await expect(
			page.getByTestId("workspace-tip-email-batching"),
		).toHaveAttribute("data-done", "true");
	});
});
