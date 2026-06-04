import { expect, test } from "./fixtures";

test("authenticated user sees app shell with task list", async ({ page }) => {
	await page.goto("/");

	// App heading is visible
	await expect(page.getByRole("heading", { name: "FlowState" })).toBeVisible();

	// Task list container rendered (proves TaskList component loaded)
	await expect(page.getByTestId("task-list")).toBeVisible();
});
