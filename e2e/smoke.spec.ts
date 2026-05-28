import { expect, test } from "@playwright/test";

test("authenticated user sees app shell with task list", async ({ page }) => {
	await page.goto("/");

	// App heading is visible
	await expect(page.getByRole("heading", { name: "FlowState" })).toBeVisible();

	// Task list section rendered (Active heading proves TaskList loaded)
	await expect(page.getByRole("heading", { name: /Active/ })).toBeVisible();
});
