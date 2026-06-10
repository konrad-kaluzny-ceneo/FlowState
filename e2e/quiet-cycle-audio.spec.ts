/**
 * Risk: S-20 + S-22 — muted hidden work expiry still surfaces catch-up and title pulse
 * Modeled on: e2e/background-tab-return.spec.ts, e2e/seed.spec.ts
 * Spec role: risk proof — muted preference + hidden expiry → catch-up + tab pulse → check-in wedge
 */
import type { Page } from "@playwright/test";

import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { runWhileHidden } from "./helpers/visibility";
import {
	addTask,
	focusTask,
	setWorkDurationSec,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

const TITLE_PULSE_PATTERN = /●/;
/** Advance past 1s work expiry but before 1.5s pulse toggle (see cycle-end-tab-pulse.ts). */
const HIDDEN_EXPIRY_CLOCK_MS = 1200;

async function setAuthMutedPreference(page: Page) {
	const response = await page.request.post("/api/trpc/preference.set", {
		data: { json: { cycleEndAudioMode: "muted" } },
	});
	expect(response.ok()).toBe(true);
	const getActiveAfterReload = page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
	await page.reload();
	await getActiveAfterReload;
	await expect(page.getByTestId("task-list")).toBeVisible();
	await ensureIdleCycle(page);
}

test.describe("Quiet cycle audio — auth (S-20)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
		await page.evaluate(() => {
			(
				window as Window & { __stopCycleEndTabPulse?: () => void }
			).__stopCycleEndTabPulse?.();
		});
	});

	test("muted hidden work expiry shows catch-up, title pulse, then check-in wedge @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Quiet Audio ${Date.now()}`;

		await setAuthMutedPreference(page);

		await addTask(page, taskTitle);
		await focusTask(page, taskTitle);
		await expect(
			page.getByTestId("cycle-audio-preference-muted"),
		).toHaveAttribute("aria-pressed", "true");
		await setWorkDurationSec(page, 1);

		const originalTitle = await page.evaluate(() => document.title);
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
		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
	});

	test("live toggle updates aria-pressed for each mode (B-01) @skip-belt", async ({
		page,
	}) => {
		const taskTitle = `E2E Live Audio Toggle ${Date.now()}`;

		await addTask(page, taskTitle);
		await focusTask(page, taskTitle);

		await expect(
			page.getByTestId("cycle-audio-preference-normal"),
		).toHaveAttribute("aria-pressed", "true");

		await page.getByTestId("cycle-audio-preference-soft").click();
		await expect(
			page.getByTestId("cycle-audio-preference-soft"),
		).toHaveAttribute("aria-pressed", "true");

		await page.getByTestId("cycle-audio-preference-muted").click();
		await expect(
			page.getByTestId("cycle-audio-preference-muted"),
		).toHaveAttribute("aria-pressed", "true");

		await page.getByTestId("cycle-audio-preference-normal").click();
		await expect(
			page.getByTestId("cycle-audio-preference-normal"),
		).toHaveAttribute("aria-pressed", "true");

		await page.getByTestId("cycle-audio-preference-soft").click();
		await expect(
			page.getByTestId("cycle-audio-preference-soft"),
		).toHaveAttribute("aria-pressed", "true");

		const getActiveAfterReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await getActiveAfterReload;
		await expect(page.getByTestId("task-list")).toBeVisible();
		await focusTask(page, taskTitle);
		await expect(
			page.getByTestId("cycle-audio-preference-soft"),
		).toHaveAttribute("aria-pressed", "true");
	});

	test("normal audio user still gets catch-up on hidden work expiry (S-22 regression) @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Normal Audio ${Date.now()}`;

		await startFocusedWorkCycle(page, taskTitle, 1);
		await page.clock.install();
		await runWhileHidden(page, async () => {
			await page.clock.runFor(HIDDEN_EXPIRY_CLOCK_MS);
		});

		const catchUp = page.getByTestId("tab-return-catchup");
		await expect(catchUp).toBeVisible({ timeout: 15_000 });
		await expect(catchUp).toContainText(taskTitle);
		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible();
	});
});
