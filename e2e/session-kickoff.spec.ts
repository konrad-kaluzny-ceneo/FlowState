/**
 * Risk: S-15 / FR-021, FR-022 — session kickoff suggestion at idle wedge moments
 * Modeled on: e2e/task-suggestion.spec.ts, e2e/seed.spec.ts
 * Spec role: risk proof (kickoff card, accept, override ack, duration chip tap-to-apply)
 */
import { expect, test } from "./fixtures";
import type { CheckInEnergyUi } from "./helpers/check-in";
import {
	acceptKickoffSuggestion,
	completeKickoffReadiness,
	expectKickoffDurationChips,
	expectKickoffVisible,
	waitForKickoffSuggestionResponse,
} from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import {
	expectFocusPageReady,
	expectTaskListVisible,
} from "./helpers/task-list-locator";
import { addTaskWithAttributes } from "./helpers/work-cycle";

async function prepareSessionStartKickoff(
	page: import("@playwright/test").Page,
	deepTask: string,
	reactiveTask: string,
	readinessEnergy: CheckInEnergyUi | "skip" = "skip",
) {
	await resetWorkerSessionViaApi(page);
	await page.goto("/tasks");
	await expectTaskListVisible(page);
	await dismissFirstRunIfVisible(page);

	await addTaskWithAttributes(page, deepTask, "Deep", "Heavy");
	await addTaskWithAttributes(page, reactiveTask, "Reactive", "Light");

	// Navigate to /focus where kickoff suggestion appears
	await page.goto("/focus");
	const getActiveAfterReload = page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
	await page.reload();
	await getActiveAfterReload;
	await dismissFirstRunIfVisible(page);
	const kickoffSettled = waitForKickoffSuggestionResponse(page);
	await completeKickoffReadiness(page, readinessEnergy);
	await kickoffSettled;
}

test.describe("Session kickoff suggestion (S-15)", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/focus");
		await expectFocusPageReady(page);
	});

	test("shows kickoff card with rationale and highlighted row on session-start idle", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Kickoff Deep ${ts}`;
		const reactiveTask = `E2E Kickoff Reactive ${ts}`;

		await prepareSessionStartKickoff(page, deepTask, reactiveTask);

		await expectKickoffVisible(page, {
			title: deepTask,
			rationale: /Fresh session — here's a strong starting point/,
		});
		// suggested-task-row highlight is on /tasks page — use client-side nav
		// to preserve React context (kickoff suggestion state)
		const navLink = page
			.getByTestId("nav-tasks")
			.or(page.getByTestId("nav-mobile-tasks"))
			.first();
		await navLink.click({ timeout: 10_000 });
		await expect(page.getByTestId("task-list")).toBeVisible({
			timeout: 15_000,
		});
		await expect(page.getByTestId("suggested-task-row")).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.getByTestId("suggested-task-row").filter({ hasText: deepTask }),
		).toBeVisible();
	});

	test("FOCUSED energy selects deep-work task on mixed pool @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Focused Kickoff Deep ${ts}`;
		const reactiveTask = `E2E Focused Kickoff Reactive ${ts}`;

		await prepareSessionStartKickoff(page, deepTask, reactiveTask, "focused");

		await expectKickoffVisible(page, { title: deepTask });
		await expect(
			page.getByTestId("suggested-task-row").filter({ hasText: deepTask }),
		).toBeVisible();
	});

	test("accept path pre-focuses task and shows work-type duration chips @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Accept Kickoff Deep ${ts}`;
		const reactiveTask = `E2E Accept Kickoff Reactive ${ts}`;

		await prepareSessionStartKickoff(page, deepTask, reactiveTask);
		await expectKickoffVisible(page, { title: deepTask });
		await acceptKickoffSuggestion(page);

		await expect(page.getByTestId("timer-panel-idle")).toBeVisible();
		await expect(
			page.getByTestId("timer-panel-idle").getByText(deepTask),
		).toBeVisible();
		await expectKickoffDurationChips(page);
		await expect(page.getByTestId("kickoff-duration-chip")).toContainText(
			"45 min",
		);
	});

	test("duration chip tap stages work duration for the next start @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Chip Kickoff Deep ${ts}`;
		const reactiveTask = `E2E Chip Kickoff Reactive ${ts}`;

		await prepareSessionStartKickoff(page, deepTask, reactiveTask);
		await expectKickoffVisible(page, { title: deepTask });
		await acceptKickoffSuggestion(page);
		await expectKickoffDurationChips(page);

		await page.getByTestId("kickoff-duration-chip").click();

		await expect(page.getByTestId("work-duration-min")).toHaveValue("45");
		await expect(page.getByTestId("work-duration-sec")).toHaveValue("0");

		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();
		await expect(page.getByTestId("timer-countdown")).toHaveText("45:00");
	});

	test("override path shows acknowledgement banner and clears suggestion highlight @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(60_000);

		const ts = Date.now();
		const deepTask = `E2E Override Kickoff Deep ${ts}`;
		const reactiveTask = `E2E Override Kickoff Reactive ${ts}`;

		await prepareSessionStartKickoff(page, deepTask, reactiveTask);
		await expectKickoffVisible(page, { title: deepTask });
		await expect(page.getByTestId("suggested-task-row")).toBeVisible();

		const reactiveRow = page
			.getByRole("listitem")
			.filter({ hasText: reactiveTask })
			.first();
		await reactiveRow.getByRole("button", { name: "Focus" }).click();

		await expect(page.getByTestId("suggestion-override-ack")).toBeVisible();
		await expect(page.getByTestId("suggestion-override-ack")).toContainText(
			/noted/i,
		);
		await expect(page.getByTestId("suggested-task-row")).toHaveCount(0);
		await expect(reactiveRow).toHaveClass(/ring-focus/);
	});
});
