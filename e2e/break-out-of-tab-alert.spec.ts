/**
 * @skip-belt — documents out-of-tab break alert pattern (Notification API + hidden tab).
 */
import { expect, test, waitForCycleGetActive } from "./fixtures";
import {
	installBreakNotificationMock,
	readBreakNotificationShown,
} from "./helpers/break-out-of-tab-alert";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import {
	dismissKickoffReadinessIfVisible,
	ensureIdleCycle,
} from "./helpers/idle-cycle";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { runWhileHidden } from "./helpers/visibility";
import {
	advanceClockThroughFastWork,
	forgetFakeClock,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
	forgetFakeClock(page);
	await resetWorkerSessionViaApi(page);
	await page.goto("/");
	await expect(page.getByTestId("task-list")).toBeVisible();
	await waitForCycleGetActive(page);
	const cleanReload = page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
	await page.reload();
	await cleanReload;
	await resetCycleRecoveryAfterReload(page);
	await ensureIdleCycle(page);
});

test.afterEach(async ({ page }) => {
	forgetFakeClock(page);
	await resetWorkerSessionViaApi(page);
});

test.describe("@skip-belt Out-of-tab break alert", () => {
	test("invokes notification path when break starts while tab is hidden", async ({
		page,
		context,
	}) => {
		test.setTimeout(90_000);

		await context.grantPermissions(["notifications"]).catch(() => {});
		await installBreakNotificationMock(page);

		const taskTitle = `E2E break alert ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await dismissKickoffReadinessIfVisible(page);
		await page.getByRole("button", { name: "Continue later" }).click();
		await expect(page.getByTestId("check-in-overlay")).toBeVisible();

		await runWhileHidden(page, async () => {
			await expect(page.getByTestId("check-in-overlay")).toBeVisible();
			await page.getByTestId("check-in-energy-steady").click();
			await expect(page.getByText("Short Break")).toBeVisible({
				timeout: 15_000,
			});
		});

		expect(await readBreakNotificationShown(page)).toBe(true);
	});
});
