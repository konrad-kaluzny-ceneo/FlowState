/**
 * Risk: S-44 / US-05 — stale tasks auto-archive, archive review, bulk delete, suggestion isolation
 * Modeled on: e2e/seed.spec.ts, e2e/task-suggestion.spec.ts
 * Spec role: risk proof (archive sweep + UI + suggestion unaffected)
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { dismissKickoffReadinessIfVisible } from "./helpers/idle-cycle";
import {
	clearOnboardingKeys,
	dismissFirstRunIfVisible,
} from "./helpers/onboarding";
import {
	resetWorkerSessionViaApi,
	seedStaleArchiveScenario,
} from "./helpers/seed-scenario";
import {
	expectSuggestionVisible,
	waitForSuggestionNext,
} from "./helpers/suggestion";
import { expectTaskListVisible } from "./helpers/task-list-locator";
import {
	advanceClockThroughFastWork,
	clickStartCycle,
	completeWorkCycleWithCheckIn,
	focusTask,
	forgetFakeClock,
	resetFakeClock,
	setShortBreakDurationSec,
	setWorkDurationSec,
} from "./helpers/work-cycle";

function archivedRow(page: import("@playwright/test").Page, title: string) {
	return page.getByTestId("archived-task-row").filter({ hasText: title });
}

test.describe("Stale task archive (S-44)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		forgetFakeClock(page);
		await resetWorkerSessionViaApi(page);
		await page.goto("/");
		await clearOnboardingKeys(page);
		await expectTaskListVisible(page);
		await waitForCycleGetActive(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await resetFakeClock(page);
		await dismissFirstRunIfVisible(page);
		await dismissKickoffReadinessIfVisible(page);
	});

	test.afterEach(async ({ page }) => {
		forgetFakeClock(page);
		await resetWorkerSessionViaApi(page);
	});

	test("stale tasks leave active list, bulk delete from archive, fresh task keeps suggestions @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const ts = Date.now();
		const staleA = `E2E Stale A ${ts}`;
		const staleB = `E2E Stale B ${ts}`;
		const freshTitle = `E2E Fresh ${ts}`;

		// Seed stale + fresh tasks via API (timestamps patched in DB).
		await seedStaleArchiveScenario(page, {
			staleTitles: [staleA, staleB],
			freshTitle,
		});

		// Reload so task.list runs the lazy stale sweep.
		const taskListReload = page.waitForResponse(
			(response) => response.url().includes("task.list") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await taskListReload;
		await expectTaskListVisible(page);
		await dismissFirstRunIfVisible(page);
		await dismissKickoffReadinessIfVisible(page);

		// Stale tasks absent from active inventory; fresh task remains.
		await expect(
			page.getByRole("listitem").filter({ hasText: staleA }),
		).toHaveCount(0);
		await expect(
			page.getByRole("listitem").filter({ hasText: staleB }),
		).toHaveCount(0);
		await expect(
			page.getByRole("listitem").filter({ hasText: freshTitle }),
		).toBeVisible();

		// Open archive view and confirm stale tasks landed there.
		await page.getByTestId("task-archive-entry").click();
		await expect(page.getByTestId("task-archive-view")).toBeVisible();
		await expect(archivedRow(page, staleA)).toBeVisible();
		await expect(archivedRow(page, staleB)).toBeVisible();
		await expect(archivedRow(page, freshTitle)).toHaveCount(0);

		// Multi-select both archived tasks and permanently delete.
		await archivedRow(page, staleA)
			.getByTestId("archived-task-checkbox")
			.check();
		await archivedRow(page, staleB)
			.getByTestId("archived-task-checkbox")
			.check();
		await expect(page.getByTestId("task-archive-selected-count")).toContainText(
			"2 selected",
		);
		await page.getByTestId("task-archive-delete-selected").click();
		await expect(page.getByTestId("task-archive-delete-confirm")).toBeVisible();
		await page.getByTestId("task-archive-delete-confirm-btn").click();
		await expect(page.getByTestId("task-archive-delete-confirm")).toBeHidden();
		await expect(archivedRow(page, staleA)).toHaveCount(0);
		await expect(archivedRow(page, staleB)).toHaveCount(0);
		await expect(page.getByTestId("task-archive-empty")).toBeVisible();

		// Return to inventory — fresh task still active.
		await page.getByTestId("task-archive-back").click();
		await expect(page.getByTestId("task-archive-view")).toBeHidden();
		await expect(
			page.getByRole("listitem").filter({ hasText: freshTitle }),
		).toBeVisible();

		// Suggestion flow still works from the remaining fresh task.
		await focusTask(page, freshTitle);
		await setWorkDurationSec(page, 1);
		await setShortBreakDurationSec(page, 30);
		await clickStartCycle(page);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await advanceClockThroughFastWork(page);
		const suggestionResponse = waitForSuggestionNext(page);
		await completeWorkCycleWithCheckIn(page, "focused");
		await suggestionResponse;
		await expectSuggestionVisible(page, { title: freshTitle });
		await expect(page.getByTestId("suggestion-task-title")).not.toContainText(
			staleA,
		);
		await expect(page.getByTestId("suggestion-task-title")).not.toContainText(
			staleB,
		);
	});
});
