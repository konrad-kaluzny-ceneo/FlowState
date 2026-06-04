import { expect, test } from "@playwright/test";

import { parseCountdownToSeconds } from "../src/test-utils/countdown-tolerance";
import { expectCountdownSecondsNear } from "./helpers/countdown";

test.describe("Guest trial (S-08)", () => {
	test("guest task persists locally and survives refresh", async ({
		page,
		context,
	}) => {
		await context.clearCookies();

		test.setTimeout(60_000);

		const taskTitle = `Guest E2E ${Date.now()}`;

		await page.goto("/");
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(page.getByTestId("task-list")).toBeVisible();

		await page.getByPlaceholder("Add a new task...").fill(taskTitle);
		await page.getByRole("button", { name: "Add" }).click();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();

		const taskRow = page.getByRole("listitem").filter({ hasText: taskTitle });
		await taskRow.getByRole("button", { name: "Focus" }).click();

		await page.clock.install();
		await page.getByRole("button", { name: "15 min" }).click();
		await page.getByRole("button", { name: "Start Cycle" }).click();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		const elapsedMs = 30_000;
		await page.clock.runFor(elapsedMs);
		const countdownBeforeReload = page.getByTestId("timer-countdown");
		const remainingBeforeReload =
			(await countdownBeforeReload.textContent()) ?? "";

		await page.reload();
		await page
			.waitForResponse(
				(response) =>
					response.url().includes("cycle.getActive") && response.ok(),
				{ timeout: 20_000 },
			)
			.catch(() => {});
		await expect(page.getByTestId("guest-banner")).toBeVisible();
		await expect(
			page.getByRole("listitem").filter({ hasText: taskTitle }),
		).toBeVisible();
		await expect(page.getByTestId("timer-panel-running")).toBeVisible();

		// Countdown should match pre-reload (persisted startedAt + duration); clock may reset on reload.
		const remainingAfterReload =
			(await page.getByTestId("timer-countdown").textContent()) ?? "";
		expect(
			Math.abs(
				parseCountdownToSeconds(remainingAfterReload) -
					parseCountdownToSeconds(remainingBeforeReload),
			),
		).toBeLessThanOrEqual(2);
		await expectCountdownSecondsNear(
			page.getByTestId("timer-countdown"),
			15 * 60 - elapsedMs / 1000,
			3,
		);
	});
});
