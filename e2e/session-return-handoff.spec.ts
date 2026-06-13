/**
 * Risk: S-17 / FR-040 — 8h return handoff banner composes closure + resume note
 * Modeled on: e2e/session-closure.spec.ts
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { addTask, startFocusedWorkCycle } from "./helpers/work-cycle";

test.describe("Session return handoff (S-17)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
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

	test("shows dismissible handoff after 8h since last session end", async ({
		page,
	}) => {
		test.setTimeout(90_000);

		const taskTitle = `E2E Handoff ${Date.now()}`;

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

		await page.reload();
		await expect(page.getByTestId("task-list")).toBeVisible({
			timeout: 20_000,
		});
		await dismissFirstRunIfVisible(page);

		await expect(page.getByTestId("return-handoff-banner")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("return-handoff-line")).toContainText(
			/Continue:|Session complete/,
		);
		await expect(page.getByTestId("task-suggestion-card")).toBeHidden();

		await page.getByTestId("return-handoff-dismiss-btn").click();
		await expect(page.getByTestId("return-handoff-banner")).toBeHidden();
	});
});
