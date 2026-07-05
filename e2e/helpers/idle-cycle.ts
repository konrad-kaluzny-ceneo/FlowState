import { expect, type Page } from "@playwright/test";

import { completeCheckIn } from "./check-in";
import { continueLaterButton } from "./i18n-locators";
import {
	completeKickoffSteering,
	dismissKickoffSteeringIfVisible,
} from "./kickoff";
import { dismissFirstRunIfVisible } from "./onboarding";

async function clickEndSessionWithConfirmIfNeeded(
	page: Page,
): Promise<boolean> {
	const endSession = page.getByTestId("end-session-btn");
	if (!(await endSession.isVisible().catch(() => false))) {
		return false;
	}
	if (!(await endSession.isEnabled().catch(() => false))) {
		return false;
	}

	await endSession.click();

	const confirmOverlay = page.getByTestId("end-session-confirm-overlay");
	if (await confirmOverlay.isVisible().catch(() => false)) {
		await page.getByTestId("end-session-confirm-btn").click();
	}

	return true;
}

/** @deprecated Use `dismissKickoffSteeringIfVisible` from `./kickoff`. */
export async function dismissKickoffReadinessIfVisible(page: Page) {
	await dismissKickoffSteeringIfVisible(page);
}

export async function dismissBreakAlertsPermissionIfVisible(page: Page) {
	const prompt = page.getByTestId("break-alerts-permission-prompt");
	if (await prompt.isVisible().catch(() => false)) {
		await page.getByTestId("break-alerts-permission-not-now-btn").click();
		await expect(prompt).toBeHidden({ timeout: 5_000 });
	}
}

/** Dismiss cycle-complete modal so belt helpers can reach task list / start controls. */
export async function dismissCycleCompleteIfVisible(page: Page) {
	if (!(await page.getByTestId("cycle-complete-overlay").isVisible())) {
		return;
	}
	await dismissKickoffSteeringIfVisible(page);
	const continueLater = continueLaterButton(page);
	if (await continueLater.isVisible()) {
		await continueLater.click();
		if (await page.getByTestId("check-in-overlay").isVisible()) {
			await completeCheckIn(page, "steady");
			if (await page.getByTestId("wind-down-overlay").isVisible()) {
				await page.getByTestId("wind-down-keep-going-btn").click();
			}
		}
		return;
	}
	const suggestedContinue = page.getByTestId("break-continue-suggested-btn");
	if (await suggestedContinue.isVisible()) {
		await suggestedContinue.click();
		return;
	}
	await page.getByTestId("break-continue-btn").click();
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
		await dismissKickoffSteeringIfVisible(page);
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

		// In the redesigned UI, timer-panel-idle only shows when a task is focused.
		// Accept workbench-grid as a valid idle state (no focused task yet).
		await expect(
			page
				.getByTestId("timer-panel-idle")
				.or(page.getByTestId("home-workbench-grid"))
				.first(),
		).toBeVisible();
	}).toPass({ timeout: 20_000 });
}

export async function ensureIdleCycle(page: Page) {
	await expect(async () => {
		await dismissFirstRunIfVisible(page);

		if (await page.getByTestId("session-energy-card").isVisible()) {
			await completeKickoffSteering(page, "skip");
			throw new Error("kickoff steering dismissed — re-check idle");
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
			await dismissTaskSuggestionIfVisible(page);
			await dismissKickoffSteeringIfVisible(page);
			throw new Error("check-in completed — re-check idle");
		}

		if (await page.getByTestId("mid-cycle-prompt-overlay").isVisible()) {
			await page.getByTestId("mid-cycle-end-break-btn").click();
			throw new Error("mid-cycle prompt dismissed — re-check idle");
		}

		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			await dismissCycleCompleteIfVisible(page);
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

		const endSessionClicked = await clickEndSessionWithConfirmIfNeeded(page);
		if (endSessionClicked) {
			throw new Error("session ended — re-check idle");
		}

		await expect(page.getByTestId("timer-panel-running")).toBeHidden();
		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
		await expect(page.getByTestId("cycle-complete-overlay")).toBeHidden();
		// In the redesigned UI, timer-panel-idle only shows when a task is focused.
		// Accept either timer-panel-idle visible OR the workbench grid visible (no active cycle).
		await expect(
			page
				.getByTestId("timer-panel-idle")
				.or(page.getByTestId("home-workbench-grid"))
				.first(),
		).toBeVisible();
	}).toPass({ timeout: 30_000 });
}
