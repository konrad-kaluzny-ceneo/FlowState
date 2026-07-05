import { expect, type Page } from "@playwright/test";

import { dismissKickoffReadinessIfVisible } from "./idle-cycle";
import { isShortBreakPhaseVisible } from "./timer-phase";

export type CheckInEnergyUi = "focused" | "steady" | "fading";

const ENERGY_TEST_IDS: Record<CheckInEnergyUi, string> = {
	focused: "check-in-energy-focused",
	steady: "check-in-energy-steady",
	fading: "check-in-energy-fading",
};

export async function completeCheckIn(
	page: Page,
	energy: CheckInEnergyUi,
	options?: { waitForHidden?: boolean; expectCoach?: boolean },
) {
	await expect(page.getByTestId("check-in-overlay")).toBeVisible();
	await dismissKickoffReadinessIfVisible(page);

	const coachLine = page.getByTestId("check-in-coach-line");
	if (options?.expectCoach === true) {
		await expect(coachLine).toBeVisible();
	} else if (options?.expectCoach === false) {
		await expect(coachLine).toBeHidden();
	}

	await page.getByTestId(ENERGY_TEST_IDS[energy]).click();
	if (options?.waitForHidden !== false) {
		// B-04: check-in may stay mounted during post-check-in async break start.
		await expect
			.poll(
				async () => {
					const windDownVisible = await page
						.getByTestId("wind-down-overlay")
						.isVisible();
					const shortBreakVisible = await isShortBreakPhaseVisible(page);
					const checkInHidden = !(await page
						.getByTestId("check-in-overlay")
						.isVisible());
					return windDownVisible || shortBreakVisible || checkInHidden;
				},
				{ timeout: 15_000 },
			)
			.toBe(true);
	}
}
