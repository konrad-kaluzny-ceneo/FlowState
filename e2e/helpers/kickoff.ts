import { expect, type Page } from "@playwright/test";
import type { CheckInEnergyUi } from "./check-in";
import { dismissReturnHandoffIfVisible } from "./return-handoff";

const ENERGY_TEST_IDS: Record<CheckInEnergyUi, string> = {
	focused: "check-in-energy-focused",
	steady: "check-in-energy-steady",
	fading: "check-in-energy-fading",
};

export async function completeKickoffReadiness(
	page: Page,
	energy: CheckInEnergyUi | "skip",
) {
	await dismissReturnHandoffIfVisible(page);
	await expect(page.getByTestId("kickoff-readiness-overlay")).toBeVisible({
		timeout: 15_000,
	});

	if (energy === "skip") {
		await page.getByTestId("kickoff-readiness-skip-btn").click();
	} else {
		await page.getByTestId(ENERGY_TEST_IDS[energy]).click();
	}

	await expect(page.getByTestId("kickoff-readiness-overlay")).toBeHidden({
		timeout: 5_000,
	});
}

function isKickoffSuggestionNextResponse(response: {
	url: () => string;
	ok: () => boolean;
	request: () => { postData: () => string | null };
}): boolean {
	if (!response.url().includes("suggestion.next") || !response.ok()) {
		return false;
	}
	const postData = response.request().postData();
	return postData?.includes('"context":"kickoff"') ?? false;
}

/** Register before dismissing kickoff readiness — response can finish before the click settles. */
export function waitForKickoffSuggestionResponse(page: Page) {
	return page.waitForResponse(
		(response) => isKickoffSuggestionNextResponse(response),
		{ timeout: 20_000 },
	);
}

export async function waitForKickoffSuggestion(
	page: Page,
	options?: { readinessCompleted?: boolean },
) {
	if (options?.readinessCompleted === true) {
		await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
			timeout: 20_000,
		});
		return;
	}

	const responsePromise = waitForKickoffSuggestionResponse(page);
	await completeKickoffReadiness(page, "skip");
	await responsePromise;
}

export async function expectKickoffVisible(
	page: Page,
	options?: {
		title?: string;
		rationale?: RegExp | string;
	},
) {
	await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByTestId("suggestion-accept-btn")).toBeVisible({
		timeout: 30_000,
	});

	if (options?.title != null) {
		await expect(
			page.getByTestId("task-suggestion-card").getByText(options.title),
		).toBeVisible();
	}

	if (options?.rationale != null) {
		await expect(
			page.getByTestId("task-suggestion-card").getByText(options.rationale),
		).toBeVisible();
	}
}

export async function acceptKickoffSuggestion(page: Page) {
	await expect(page.getByTestId("suggestion-accept-btn")).toBeEnabled();
	await page.getByTestId("suggestion-accept-btn").click();
}

export async function expectKickoffDurationChips(page: Page) {
	await expect(page.getByTestId("kickoff-duration-chips")).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByTestId("kickoff-duration-chip")).toBeVisible();
}
