import { expect, type Page } from "@playwright/test";

export async function ensureIdleCycle(page: Page) {
	await expect(async () => {
		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			const continueLater = page.getByRole("button", {
				name: "Continue later",
			});
			if (await continueLater.isVisible()) {
				await continueLater.click();
			} else {
				await page.getByTestId("break-continue-btn").click();
			}
			throw new Error("cycle overlay dismissed — re-check idle");
		}

		if (await page.getByTestId("timer-panel-running").isVisible()) {
			const interruptLabel = (await page
				.getByRole("button", { name: "End break early" })
				.isVisible())
				? "End break early"
				: "Interrupt";
			await page.getByRole("button", { name: interruptLabel }).click();
			throw new Error("running cycle interrupted — re-check idle");
		}

		const endSession = page.getByTestId("end-session-btn");
		if ((await endSession.isVisible()) && (await endSession.isEnabled())) {
			await endSession.click();
			throw new Error("session ended — re-check idle");
		}

		await expect(page.getByTestId("timer-panel-running")).toBeHidden();
		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		await expect(page.getByPlaceholder("Add a new task...")).toBeEnabled();
	}).toPass({ timeout: 30_000 });
}
