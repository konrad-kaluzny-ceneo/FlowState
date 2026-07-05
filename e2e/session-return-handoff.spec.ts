/**
 * Risk: S-17 / FR-040 — continue row + kickoff after ended session (no top banner)
 * Modeled on: e2e/session-closure.spec.ts
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { completeKickoffSteering } from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { addTask, startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Session return continue row (S-17)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/focus");
		await expectFocusPageReady(page);
		await waitForCycleGetActive(page);
		await resetWorkerSessionViaApi(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await ensureIdleCycle(page);
		await dismissFirstRunIfVisible(page);
	});

	test("shows continue row and kickoff suggestion without handoff banner", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E Continue ${Date.now()}`;

		await addTask(page, taskTitle);

		await startFocusedWorkCycle(page, taskTitle, 1);
		await expect(page.getByTestId("timer-panel-running")).toBeVisible({
			timeout: 15_000,
		});

		await page.getByRole("button", { name: "Interrupt" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeHidden({
			timeout: 15_000,
		});
		await page.getByTestId("end-session-btn").click();
		await expect(page.getByTestId("session-closure-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByTestId("session-closure-dismiss-btn").click();
		await expect(page.getByTestId("session-closure-overlay")).toBeHidden();

		const lastEndedReady = page.waitForResponse(
			(response) =>
				response.url().includes("session.getLastEnded") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await lastEndedReady;
		await expectFocusPageReady(page);
		await dismissFirstRunIfVisible(page);

		await expect(page.getByTestId("return-handoff-banner")).toHaveCount(0);
		await expect(page.getByTestId("session-energy-card")).toBeVisible({
			timeout: 15_000,
		});

		// Check the continue-here row on the tasks page
		await page.goto("/tasks");
		await expect(page.getByTestId("task-list")).toBeVisible({
			timeout: 15_000,
		});
		const taskRow = page
			.getByRole("listitem")
			.filter({ hasText: taskTitle })
			.first();
		await expect(taskRow.getByTestId("continue-here-row")).toBeVisible({
			timeout: 15_000,
		});

		// Navigate back to focus for kickoff suggestion check
		await page.goto("/focus");
		await completeKickoffSteering(page, "skip");

		await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
			timeout: 20_000,
		});
	});
});
