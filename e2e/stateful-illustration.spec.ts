/**
 * S-43 stateful-illustration-system — Phase 4 E2E.
 * Risk: the Calm Garden illustration is not actually bound to live session
 * state (hero + desktop rail), or is exposed to assistive tech, or leaks
 * into wedge gate overlays.
 * Modeled on: e2e/seed.spec.ts (fixture auth, helper flows, testid locators).
 * Full-catalog spec — tagged @skip-belt per plan.md Phase 4 (not a belt gate).
 */
import type { Page } from "@playwright/test";

import { expect, test, waitForCycleGetActive } from "./fixtures";
import { completeCheckIn } from "./helpers/check-in";
import { dismissKickoffReadinessIfVisible } from "./helpers/idle-cycle";
import { completeKickoffSteering } from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectTaskListVisible } from "./helpers/task-list-locator";
import { expectShortBreakPhaseVisible } from "./helpers/timer-phase";
import {
	addTask,
	advanceClockThroughFastWork,
	forgetFakeClock,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

// Rail slot is `hidden lg:flex` — pin a >=1024px viewport so rail assertions hold.
test.use({ viewport: { width: 1280, height: 800 } });

test.describe.configure({ mode: "serial" });

/** Rail copy of the illustration, scoped to the S-41 reserved slot. */
function railIllustration(page: Page) {
	return page
		.getByTestId("home-rail-illustration")
		.getByTestId("home-hero-sprig");
}

/** Hero copy — first match in DOM order (header renders before the dashboard rail). */
function heroIllustration(page: Page) {
	return page.getByTestId("home-hero-sprig").first();
}

/** Both render sites must agree on the variant and stay aria-hidden throughout. */
async function expectIllustrationVariant(page: Page, variant: string) {
	const hero = heroIllustration(page);
	const rail = railIllustration(page);
	await expect(hero).toHaveAttribute("data-illustration-variant", variant);
	await expect(hero).toHaveAttribute("aria-hidden", "true");
	await expect(rail).toHaveAttribute("data-illustration-variant", variant);
	await expect(rail).toHaveAttribute("aria-hidden", "true");
}

test.beforeEach(async ({ page }) => {
	forgetFakeClock(page);
	// API reset before navigation — avoid hydrating a stale RUNNING cycle.
	await resetWorkerSessionViaApi(page);
	await page.goto("/");
	await expectTaskListVisible(page);
	await waitForCycleGetActive(page);
	await dismissFirstRunIfVisible(page);
});

test.afterEach(async ({ page }) => {
	forgetFakeClock(page);
	await resetWorkerSessionViaApi(page);
});

test.describe("Stateful illustration (S-43) — variant bound to session state", () => {
	test("hero and rail illustration follow idle → energy_choice → idle → work → break and stay aria-hidden @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(120_000);

		// Fresh reset, no session, no steering card yet → baseline idle variant.
		await expectIllustrationVariant(page, "idle");

		// Seed one active task, then reload: session-start idle with active tasks
		// makes kickoff steering (energy card) eligible — the `steering` state.
		const ts = Date.now();
		await addTask(page, `E2E Illustration Steering ${ts}`);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		forgetFakeClock(page);
		await expectTaskListVisible(page);
		await dismissFirstRunIfVisible(page);

		// Steering (inline, not a wedge gate) → energy_choice variant.
		await expect(page.getByTestId("session-energy-card")).toBeVisible({
			timeout: 15_000,
		});
		await expectIllustrationVariant(page, "energy_choice");

		// Skipping both steering cards settles back to idle.
		await completeKickoffSteering(page, "skip");
		await expectIllustrationVariant(page, "idle");

		// Running work cycle → work variant.
		await startFocusedWorkCycle(page, `E2E Illustration Work ${ts}`, 1);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expectIllustrationVariant(page, "work");

		// Work completes → cycle-complete gate. Gates never contain the illustration.
		await advanceClockThroughFastWork(page);
		const cycleCompleteOverlay = page.getByTestId("cycle-complete-overlay");
		await expect(cycleCompleteOverlay).toBeVisible({ timeout: 15_000 });
		await expect(
			cycleCompleteOverlay.getByTestId("home-hero-sprig"),
		).toHaveCount(0);
		await dismissKickoffReadinessIfVisible(page);
		await page.getByRole("button", { name: "Continue later" }).click();

		// Check-in gate blocks the break — also illustration-free.
		const checkInOverlay = page.getByTestId("check-in-overlay");
		await expect(checkInOverlay).toBeVisible();
		await expect(checkInOverlay.getByTestId("home-hero-sprig")).toHaveCount(0);
		await completeCheckIn(page, "steady");

		// Short break running → break variant on both render sites.
		await expectShortBreakPhaseVisible(page, { timeout: 15_000 });
		await expectIllustrationVariant(page, "break");
	});
});
