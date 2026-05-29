import { expect, test } from "@playwright/test";

test.describe("Pomodoro cycle (S-01)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");

		if (await page.getByTestId("cycle-complete-overlay").isVisible()) {
			await page.getByRole("button", { name: "Continue later" }).click();
		}

		if (await page.getByRole("button", { name: "Interrupt" }).isVisible()) {
			await page.getByRole("button", { name: "Interrupt" }).click();
		}
	});

	test("focus, start, complete via clock, continue later", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Pomodoro ${Date.now()}`;

		await page.clock.install();

		await expect(page.getByTestId("task-list")).toBeVisible();

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(page.getByText(taskTitle)).toBeVisible();

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();
		await expect(taskRow).toHaveClass(/ring-purple-500/);

		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();

		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
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
		await expect(page.getByText(taskTitle)).toBeVisible();
		await expect(taskRow.getByRole("button", { name: "Focus" })).toBeVisible();
	});

	test("mark task done from completion overlay", async ({ page }) => {
		test.setTimeout(60_000);

		const taskTitle = `E2E Done ${Date.now()}`;

		await page.clock.install();

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();

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
