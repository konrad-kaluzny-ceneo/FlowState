import { expect, type Page } from "@playwright/test";

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

	const coachLine = page.getByTestId("check-in-coach-line");
	if (options?.expectCoach === true) {
		await expect(coachLine).toBeVisible();
	} else if (options?.expectCoach === false) {
		await expect(coachLine).toBeHidden();
	}

	await page.getByTestId(ENERGY_TEST_IDS[energy]).click();
	if (options?.waitForHidden !== false) {
		await expect(page.getByTestId("check-in-overlay")).toBeHidden();
	}
}
