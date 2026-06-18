import { expect, type Page } from "@playwright/test";

import { completeCheckIn } from "./check-in";
import { dismissFirstRunIfVisible } from "./onboarding";
import { dismissReturnHandoffIfVisible } from "./return-handoff";

export async function dismissKickoffReadinessIfVisible(page: Page) {
	const overlay = page.getByTestId("kickoff-readiness-overlay");
	if (await overlay.isVisible().catch(() => false)) {
		await page.getByTestId("kickoff-readiness-skip-btn").click();
		await expect(overlay).toBeHidden({ timeout: 5_000 });
	}
}

export async function dismissTaskSuggestionIfVisible(page: Page) {
	const card = page.getByTestId("task-suggestion-card");
	if (!(await card.isVisible().catch(() => false))) {
		return;
	}
	const acceptBtn = card.getByTestId("suggestion-accept-btn");
	if (!(await acceptBtn.isVisible().catch(() => false))) {
		return;
	}
	await expect(acceptBtn).toBeEnabled({ timeout: 10_000 });
	await acceptBtn.click();
	await expect(card).toBeHidden({ timeout: 10_000 });
}

/** Dismiss blocking overlays until the idle timer shell is mounted. */
export async function waitForTimerPanelIdle(page: Page) {
	await expect(async () => {
		await dismissKickoffReadinessIfVisible(page);
		await dismissTaskSuggestionIfVisible(page);

		if (await page.getByTestId("timer-panel-running").isVisible()) {
			const interruptLabel = (await page
				.getByRole("button", { name: "End break early" })
				.isVisible())
				? "End break early"
				: "Interrupt";
			await page.getByRole("button", { name: interruptLabel }).click();
			throw new Error("running cycle interrupted — re-check idle");
		}

		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
	}).toPass({ timeout: 20_000 });
}

export async function ensureIdleCycle(page: Page) {
	await expect(async () => {
		await dismissFirstRunIfVisible(page);
		await dismissReturnHandoffIfVisible(page);

		if (await page.getByTestId("kickoff-readiness-overlay").isVisible()) {
			await page.getByTestId("kickoff-readiness-skip-btn").click();
			throw new Error("kickoff readiness dismissed — re-check idle");
		}

		if (await page.getByTestId("task-suggestion-card").isVisible()) {
			await dismissTaskSuggestionIfVisible(page);
			throw new Error("task suggestion dismissed — re-check idle");
		}

		if (await page.getByTestId("wind-down-overlay").isVisible()) {
			await page.getByTestId("wind-down-keep-going-btn").click();
			throw new Error("wind-down dismissed — re-check idle");
		}

		if (await page.getByTestId("check-in-overlay").isVisible()) {
			await completeCheckIn(page, "steady");
			if (await page.getByTestId("wind-down-overlay").isVisible()) {
				await page.getByTestId("wind-down-keep-going-btn").click();
			}
			throw new Error("check-in completed — re-check idle");
		}

		if (await page.getByTestId("mid-cycle-prompt-overlay").isVisible()) {
			await page.getByTestId("mid-cycle-end-break-btn").click();
			throw new Error("mid-cycle prompt dismissed — re-check idle");
		}

		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			await dismissKickoffReadinessIfVisible(page);
			const continueLater = page.getByRole("button", {
				name: "Continue later",
			});
			if (await continueLater.isVisible()) {
				await continueLater.click();
				if (await page.getByTestId("check-in-overlay").isVisible()) {
					await completeCheckIn(page, "steady");
				}
			} else {
				const suggestedContinue = page.getByTestId(
					"break-continue-suggested-btn",
				);
				if (await suggestedContinue.isVisible()) {
					await suggestedContinue.click();
				} else {
					await page.getByTestId("break-continue-btn").click();
				}
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
		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		await expect(page.getByPlaceholder("Add a new task...")).toBeEnabled();
	}).toPass({ timeout: 30_000 });
}
