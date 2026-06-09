/**
 * Risk: S-26 — manual task priority order via drag handle persists across reload and guest merge
 * Modeled on: e2e/seed.spec.ts, e2e/guest-merge-on-sign-in.spec.ts
 * Spec role: risk proof — drag-reorder active list + sortOrder persistence
 */

import type { Page } from "@playwright/test";
import { expect, test, waitForCycleGetActive } from "./fixtures";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	dismissFirstRunIfVisible,
	dismissMergeSuccessIfVisible,
} from "./helpers/onboarding";
import { createTestUser, signInAsUser } from "./helpers/user";
import { addTasks } from "./helpers/work-cycle";

function activeTaskRows(page: Page) {
	return page
		.locator("section")
		.filter({ has: page.getByRole("heading", { name: /Active/ }) })
		.getByRole("listitem");
}

async function getActiveTaskTitlesInOrder(page: Page): Promise<string[]> {
	const rows = activeTaskRows(page);
	const count = await rows.count();
	const titles: string[] = [];

	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const titleText = await row.locator(".flex-1").first().innerText();
		titles.push(titleText.trim());
	}

	return titles;
}

async function dragActiveTaskToIndex(
	page: Page,
	fromIndex: number,
	toIndex: number,
) {
	const rows = activeTaskRows(page);
	const sourceHandle = rows.nth(fromIndex).getByTestId("task-drag-handle");
	const targetHandle = rows.nth(toIndex).getByTestId("task-drag-handle");
	const sourceBox = await sourceHandle.boundingBox();
	const targetBox = await targetHandle.boundingBox();

	if (sourceBox == null || targetBox == null) {
		throw new Error("Could not resolve drag handle positions");
	}

	const sourceX = sourceBox.x + sourceBox.width / 2;
	const sourceY = sourceBox.y + sourceBox.height / 2;
	const targetX = targetBox.x + targetBox.width / 2;
	const targetY = targetBox.y + targetBox.height / 2;

	await page.mouse.move(sourceX, sourceY);
	await page.mouse.down();
	await page.mouse.move(sourceX, sourceY + 12, { steps: 3 });
	await page.mouse.move(targetX, targetY, { steps: 25 });
	await page.mouse.up();
}

async function dismissKickoffSuggestionIfVisible(page: Page) {
	const card = page.getByTestId("task-suggestion-card");
	if (!(await card.isVisible().catch(() => false))) {
		return;
	}

	const thirdRow = activeTaskRows(page).nth(2);
	if (await thirdRow.isVisible().catch(() => false)) {
		await thirdRow.getByRole("button", { name: "Focus" }).click();
	}
}

test.describe("Task reorder (S-26)", () => {
	test("authenticated drag handle reorders active tasks and persists after reload", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		await page.goto("/");
		await expect(page.getByTestId("task-list")).toBeVisible();
		await waitForCycleGetActive(page);
		await ensureIdleCycle(page);

		const ts = Date.now();
		const taskA = `Reorder A ${ts}`;
		const taskB = `Reorder B ${ts}`;
		const taskC = `Reorder C ${ts}`;

		await addTasks(page, [taskA, taskB, taskC]);
		await dismissKickoffSuggestionIfVisible(page);

		const rows = activeTaskRows(page);
		await expect(rows).toHaveCount(3);
		await expect(await getActiveTaskTitlesInOrder(page)).toEqual([
			taskA,
			taskB,
			taskC,
		]);

		const reorderResponse = page.waitForResponse(
			(response) => response.url().includes("task.reorder") && response.ok(),
			{ timeout: 15_000 },
		);
		await dragActiveTaskToIndex(page, 1, 0);
		await reorderResponse;
		await expect
			.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 15_000 })
			.toEqual([taskB, taskA, taskC]);

		const getActiveAfterReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await getActiveAfterReload;
		await ensureIdleCycle(page);
		await dismissKickoffSuggestionIfVisible(page);

		await expect
			.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 30_000 })
			.toEqual([taskB, taskA, taskC]);
	});

	test("guest merge preserves manual order on sign-in", async ({
		page,
		context,
		request,
	}) => {
		await context.clearCookies();

		test.setTimeout(90_000);

		const ts = Date.now();
		const guestFirst = `Guest first ${ts}`;
		const guestSecond = `Guest second ${ts}`;

		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await dismissFirstRunIfVisible(page);

		await addTasks(page, [guestSecond, guestFirst]);
		await dragActiveTaskToIndex(page, 1, 0);
		await expect
			.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 15_000 })
			.toEqual([guestFirst, guestSecond]);

		const user = await createTestUser(request);
		const authState = await signInAsUser(request, user);
		await context.addCookies(authState.cookies);
		await page.goto("/");

		await dismissMergeSuccessIfVisible(page, { appearTimeoutMs: 30_000 });
		await expect(page.getByTestId("guest-banner")).toBeHidden({
			timeout: 30_000,
		});

		await expect
			.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 30_000 })
			.toEqual([guestFirst, guestSecond]);
	});
});
