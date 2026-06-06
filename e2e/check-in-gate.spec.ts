import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	advanceClockThroughFastWork,
	startFocusedWorkCycle,
} from "./helpers/work-cycle";

test.describe("Check-in gate (Risk #7)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);
	});

	test("gate blocks break until energy selected; persists check-in", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `Check-in gate ${Date.now()}`;
		await startFocusedWorkCycle(page, taskTitle, 1);
		await advanceClockThroughFastWork(page);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page.getByRole("button", { name: "Continue later" }).click();

		await expect(page.getByTestId("check-in-overlay")).toBeVisible();
		await expect(page.getByText("Short Break")).toBeHidden();

		const isCheckInMutation = (postData: string | null) =>
			postData != null &&
			postData.includes("STEADY") &&
			/"cycleId":\s*\d+/.test(postData);

		const [request, response] = await Promise.all([
			page.waitForRequest(
				(req) =>
					req.method() === "POST" &&
					req.url().includes("/api/trpc") &&
					isCheckInMutation(req.postData()),
			),
			page.waitForResponse(
				(res) =>
					res.request().method() === "POST" &&
					res.url().includes("/api/trpc") &&
					isCheckInMutation(res.request().postData()) &&
					res.ok(),
			),
			page.getByTestId("check-in-energy-steady").click(),
		]);

		expect(response.ok()).toBeTruthy();
		const postData = request.postData() ?? "";
		expect(postData).toContain("STEADY");
		expect(postData).toMatch(/"cycleId":\s*\d+/);

		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(page.getByText("Short Break")).toBeVisible();
	});
});
