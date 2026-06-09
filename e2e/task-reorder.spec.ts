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

async function waitForTaskReorderOk(page: Page) {
	return page.waitForResponse(async (response) => {
		if (response.request().method() !== "POST") {
			return false;
		}
		if (!response.url().includes("/api/trpc")) {
			return false;
		}
		const url = response.url();
		const postData = response.request().postData() ?? "";
		const isReorder =
			url.includes("task.reorder") || postData.includes("task.reorder");
		if (!isReorder || !response.ok()) {
			return false;
		}
		try {
			const body: unknown = await response.json();
			if (Array.isArray(body)) {
				return body.every(
					(chunk) =>
						chunk == null ||
						(typeof chunk === "object" &&
							chunk !== null &&
							!("error" in chunk && chunk.error != null)),
				);
			}
			return !(
				typeof body === "object" &&
				body !== null &&
				"error" in body &&
				(body as { error?: unknown }).error != null
			);
		} catch {
			return true;
		}
	});
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

	await sourceHandle.hover();
	await page.mouse.move(sourceX, sourceY);
	await page.mouse.down();
	// Satisfy PointerSensor activationConstraint (distance: 8)
	await page.mouse.move(sourceX, sourceY + 10, { steps: 5 });
	await page.mouse.move(targetX, targetY, { steps: 30 });
	await page.mouse.up();
}

async function reorderActiveTasksByDrag(
	page: Page,
	fromIndex: number,
	toIndex: number,
	expected: string[],
) {
	const current = await getActiveTaskTitlesInOrder(page);
	if (JSON.stringify(current) === JSON.stringify(expected)) {
		return;
	}

	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		if (
			JSON.stringify(await getActiveTaskTitlesInOrder(page)) ===
			JSON.stringify(expected)
		) {
			return;
		}

		const reorderResponse = waitForTaskReorderOk(page);

		try {
			await dragActiveTaskToIndex(page, fromIndex, toIndex);
			await reorderResponse;
			await expect(page.getByTestId("task-list-error")).toBeHidden();
			await expect
				.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 30_000 })
				.toEqual(expected);
			return;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError ?? new Error("Failed to reorder active tasks by drag");
}
function waitForTaskListOk(page: Page) {
	return page.waitForResponse(
		(response) => response.url().includes("task.list") && response.ok(),
		{ timeout: 20_000 },
	);
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
		test.setTimeout(120_000);

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

		await reorderActiveTasksByDrag(page, 1, 0, [taskB, taskA, taskC]);

		const getActiveAfterReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 30_000 },
		);
		const taskListAfterReload = waitForTaskListOk(page);
		await page.goto(`/?e2e=${Date.now()}`, { waitUntil: "networkidle" });
		await Promise.all([getActiveAfterReload, taskListAfterReload]);
		await ensureIdleCycle(page);
		await dismissKickoffSuggestionIfVisible(page);

		await expect
			.poll(async () => getActiveTaskTitlesInOrder(page), { timeout: 90_000 })
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
