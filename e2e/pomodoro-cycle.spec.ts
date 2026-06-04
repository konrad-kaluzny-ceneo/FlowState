import { expect, type Page, test } from "@playwright/test";

import { parseCountdownToSeconds } from "../src/test-utils/countdown-tolerance";

async function ensureIdleCycle(page: Page) {
	await expect(async () => {
		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			await page.getByRole("button", { name: "Continue later" }).click();
			throw new Error("cycle overlay dismissed — re-check idle");
		}

		const interrupt = page.getByRole("button", { name: "Interrupt" });
		if (await interrupt.isVisible()) {
			await interrupt.click();
			throw new Error("cycle interrupted — re-check idle");
		}
	}).toPass({ timeout: 30_000 });
}

test.describe("Pomodoro cycle (S-01)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await page
			.waitForResponse(
				(response) =>
					response.url().includes("cycle.getActive") && response.ok(),
				{ timeout: 20_000 },
			)
			.catch(() => {});
		await ensureIdleCycle(page);
	});

	test("focus, start, complete via clock, continue later", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Pomodoro ${Date.now()}`;

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await ensureIdleCycle(page);

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();
		await expect(taskRow).toHaveClass(/ring-purple-500/);

		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();

		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await page.clock.install();
		await expect(page.getByTestId("timer-countdown")).toBeVisible();

		await page.clock.runFor(15 * 60 * 1000 + 2000);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await expect(
			page.getByRole("button", { name: "Continue later" }),
		).toBeVisible();

		await page.getByRole("button", { name: "Continue later" }).click();

		await expect(page.getByTestId("cycle-complete-overlay")).not.toBeVisible();
		await expect(page.getByTestId("timer-panel-running")).not.toBeVisible();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await expect(taskRow.getByRole("button", { name: "Focus" })).toBeVisible();
	});

	test("mid-cycle reload preserves task, running panel, and countdown", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Reload ${Date.now()}`;

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await ensureIdleCycle(page);

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();

		await page.clock.install();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		const elapsedMs = 30_000;
		await page.clock.runFor(elapsedMs);
		const remainingBeforeReload =
			(await page.getByTestId("timer-countdown").textContent()) ?? "";

		const getActiveAfterReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await getActiveAfterReload;

		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();

		const remainingAfterReload =
			(await page.getByTestId("timer-countdown").textContent()) ?? "";
		expect(
			Math.abs(
				parseCountdownToSeconds(remainingAfterReload) -
					parseCountdownToSeconds(remainingBeforeReload),
			),
		).toBeLessThanOrEqual(2);
	});

	test("mark task done from completion overlay", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Done ${Date.now()}`;

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await ensureIdleCycle(page);

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();

		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await page.clock.install();

		await page.clock.runFor(15 * 60 * 1000 + 2000);

		await expect(page.getByTestId("cycle-complete-overlay")).toBeVisible({
			timeout: 15_000,
		});
		await page
			.getByRole("button", { name: "Done — mark task complete" })
			.click();

		await expect(page.getByTestId("cycle-complete-overlay")).not.toBeVisible();
		await expect(
			page.getByRole("heading", { name: /Completed/ }),
		).toBeVisible();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toHaveCount(1);
	});
});
