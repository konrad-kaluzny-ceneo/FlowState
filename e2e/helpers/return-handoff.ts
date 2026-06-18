import { expect, type Page } from "@playwright/test";

/** Dismiss return handoff banner when visible (pol-10 — before kickoff readiness). */
export async function dismissReturnHandoffIfVisible(page: Page) {
	const banner = page.getByTestId("return-handoff-banner");
	if (await banner.isVisible().catch(() => false)) {
		await page.getByTestId("return-handoff-dismiss-btn").click();
		await expect(banner).toBeHidden({ timeout: 10_000 });
	}
}
