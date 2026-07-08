/**
 * Risk: S-27 / US-03 — daily standing tasks + focus-hours capacity-aware suggestions
 * Modeled on: e2e/task-suggestion.spec.ts, e2e/session-kickoff.spec.ts
 * Spec role: risk proof (capacity rationale, standing pool exclusion, standing UX)
 */
import { expect, test } from "./fixtures";
import { resetCycleRecoveryAfterReload } from "./helpers/cycle-recovery";
import { seedCapacitySuggestionScenario } from "./helpers/daily-plan";
import { ensureIdleCycle } from "./helpers/idle-cycle";
import {
	dismissKickoffSteeringIfVisible,
	expectKickoffVisible,
	waitForKickoffSuggestionResponse,
} from "./helpers/kickoff";
import { dismissFirstRunIfVisible } from "./helpers/onboarding";
import { resetWorkerSessionViaApi } from "./helpers/seed-scenario";
import { expectFocusPageReady } from "./helpers/task-list-locator";
import { forgetFakeClock, resetFakeClock } from "./helpers/work-cycle";

test.describe("Daily standing + focus capacity (S-27)", () => {
	test.describe.configure({ mode: "serial" });

	test.beforeEach(async ({ page }) => {
		await page.goto("/focus");
		await expectFocusPageReady(page);
		await resetWorkerSessionViaApi(page);
		forgetFakeClock(page);
		const cleanReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await cleanReload;
		await resetCycleRecoveryAfterReload(page);
		await resetFakeClock(page);
		await dismissFirstRunIfVisible(page);
		await ensureIdleCycle(page);
	});

	test("kickoff star suggests capacity-fit standing task with rationale @skip-belt", async ({
		page,
	}) => {
		test.setTimeout(30_000);

		const ts = Date.now();
		const standingTitle = `E2E Standing ${ts}`;
		const longTitle = `E2E Long ${ts}`;

		await seedCapacitySuggestionScenario(page, {
			standingTitle,
			longTaskTitle: longTitle,
			remainingMinutes: 30,
		});

		const taskListReload = page.waitForResponse(
			(response) => response.url().includes("cycle.getActive") && response.ok(),
			{ timeout: 20_000 },
		);
		await page.reload();
		await taskListReload;
		await dismissFirstRunIfVisible(page);

		const suggestionResponse = waitForKickoffSuggestionResponse(page);
		await dismissKickoffSteeringIfVisible(page);
		await suggestionResponse;

		await expectKickoffVisible(page, {
			title: standingTitle,
		});

		const rationaleToggle = page.getByTestId("suggestion-rationale-toggle");
		if (await rationaleToggle.isVisible()) {
			await rationaleToggle.click();
			await expect(
				page.getByTestId("suggestion-rationale-expander"),
			).toContainText(/min left today/i);
		} else {
			await expect(page.getByTestId("task-suggestion-card")).toContainText(
				/min left today/i,
			);
		}
	});
});
