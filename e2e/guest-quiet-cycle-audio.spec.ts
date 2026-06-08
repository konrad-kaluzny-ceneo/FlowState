/**
 * Risk: S-20 + S-22 — guest muted preference + hidden work expiry catch-up and title pulse
 * Modeled on: e2e/guest-background-tab-return.spec.ts, e2e/guest-trial.spec.ts
 * Spec role: risk proof (guest-chromium project)
 */
import { expect, test } from "@playwright/test";

import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import { runWhileHidden } from "./helpers/visibility";
import { addTask, focusTask, setWorkDurationSec } from "./helpers/work-cycle";

const GUEST_MUTED_KEY = "flowstate:cycleEndAudio:guest";
const TITLE_PULSE_PATTERN = /●/;
/** Advance past 1s work expiry but before 1.5s pulse toggle (see cycle-end-tab-pulse.ts). */
const HIDDEN_EXPIRY_CLOCK_MS = 1200;

test.describe("Quiet cycle audio — guest (S-20)", () => {
	test.beforeEach(async ({ page, context }) => {
		await context.clearCookies();
		await page.addInitScript((key) => {
			localStorage.setItem(key, JSON.stringify("muted"));
		}, GUEST_MUTED_KEY);
		await page.goto("/");
		await clearOnboardingKeys(page);
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await dismissFirstRunIfVisible(page);
		await page.evaluate(() => {
			(
				window as Window & { __stopCycleEndTabPulse?: () => void }
			).__stopCycleEndTabPulse?.();
		});
	});

	test("guest muted hidden work expiry shows catch-up and title pulse", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `Guest Quiet Audio ${Date.now()}`;

		const originalTitle = await page.evaluate(() => document.title);

		await addTask(page, taskTitle);
		await focusTask(page, taskTitle);
		await expect(
			page.getByTestId("cycle-audio-preference-muted"),
		).toHaveAttribute("aria-pressed", "true");
		await setWorkDurationSec(page, 1);

		await page.clock.install();
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		let titleWhileHidden: string | null = null;
		await runWhileHidden(page, async () => {
			await page.clock.runFor(HIDDEN_EXPIRY_CLOCK_MS);
			titleWhileHidden = await page.title();
		});

		expect(titleWhileHidden).toMatch(TITLE_PULSE_PATTERN);

		const catchUp = page.getByTestId("tab-return-catchup");
		await expect(catchUp).toBeVisible({ timeout: 15_000 });
		await expect(catchUp).toContainText(taskTitle);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible();

		await page.getByRole("button", { name: "Continue later" }).click();
		await expect(catchUp).toBeHidden();

		const titleAfterDismiss = await page.evaluate(() => document.title);
		expect(titleAfterDismiss).not.toMatch(TITLE_PULSE_PATTERN);
		expect(titleAfterDismiss).toBe(originalTitle);
		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
	});
});
