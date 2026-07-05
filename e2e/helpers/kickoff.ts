import { expect, type Page } from "@playwright/test";
import type { CheckInEnergyUi } from "./check-in";
import { dismissFirstRunIfVisible } from "./onboarding";

const ENERGY_TEST_IDS: Record<CheckInEnergyUi, string> = {
	focused: "check-in-energy-focused",
	steady: "check-in-energy-steady",
	fading: "check-in-energy-fading",
};

export type KickoffSteeringIntentionChip =
	| "deep-work"
	| "clear-inbox"
	| "ship-feature";

export type CompleteKickoffSteeringOptions =
	| "skip"
	| {
			energy?: CheckInEnergyUi | "skip";
			focus?:
				| "skip"
				| { chip: KickoffSteeringIntentionChip }
				| { intention: string };
	  };

export async function completeKickoffSteering(
	page: Page,
	options: CompleteKickoffSteeringOptions = "skip",
) {
	const energyCard = page.getByTestId("session-energy-card");
	await expect(energyCard).toBeVisible({ timeout: 15_000 });

	const energy = options === "skip" ? "skip" : (options.energy ?? "skip");
	const focus = options === "skip" ? "skip" : (options.focus ?? "skip");

	if (energy === "skip") {
		await page.getByTestId("session-energy-skip-btn").click();
	} else {
		await page.getByTestId(ENERGY_TEST_IDS[energy]).click();
		await page.getByTestId("session-energy-continue-btn").click();
	}
	await expect(energyCard).toBeHidden({ timeout: 5_000 });

	const focusCard = page.getByTestId("session-focus-card");
	if (!(await focusCard.isVisible().catch(() => false))) {
		return;
	}

	if (focus === "skip") {
		await page.getByTestId("session-focus-skip-btn").click();
	} else if ("chip" in focus) {
		await page.getByTestId(`steering-intention-${focus.chip}`).click();
	} else {
		await page.getByTestId("steering-intention-input").fill(focus.intention);
		await page.getByTestId("steering-intention-submit-btn").click();
	}
	await expect(focusCard).toBeHidden({ timeout: 5_000 });
}

/** @deprecated Use `completeKickoffSteering` — skips both energy and focus cards. */
export async function completeKickoffReadiness(
	page: Page,
	energy: CheckInEnergyUi | "skip",
) {
	if (energy === "skip") {
		await completeKickoffSteering(page, "skip");
		return;
	}
	await completeKickoffSteering(page, { energy, focus: "skip" });
}

export async function dismissKickoffSteeringIfVisible(page: Page) {
	const energyCard = page.getByTestId("session-energy-card");
	if (await energyCard.isVisible().catch(() => false)) {
		await completeKickoffSteering(page, "skip");
	}
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

/** Register before dismissing steering cards — response can finish before clicks settle. */
export function waitForKickoffSuggestionResponse(page: Page) {
	return page.waitForResponse(
		(response) => isKickoffSuggestionNextResponse(response),
		{ timeout: 20_000 },
	);
}

export async function waitForKickoffSuggestion(
	page: Page,
	options?: { steeringCompleted?: boolean },
) {
	if (options?.steeringCompleted === true) {
		await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
			timeout: 20_000,
		});
		return;
	}

	const responsePromise = waitForKickoffSuggestionResponse(page);
	await completeKickoffSteering(page, "skip");
	await responsePromise;
}

export async function expectKickoffVisible(
	page: Page,
	options?: {
		title?: string;
		rationale?: RegExp | string;
	},
) {
	await dismissFirstRunIfVisible(page);

	const kickoffHeader = page.getByTestId("focus-ready-kickoff");
	if (await kickoffHeader.isVisible().catch(() => false)) {
		if (options?.title != null) {
			await expect(kickoffHeader).toContainText(options.title);
		}
	}

	if (
		!(await page
			.getByTestId("task-suggestion-card")
			.isVisible()
			.catch(() => false))
	) {
		const star = page
			.getByTestId("focus-ready-kickoff-suggestion-star")
			.or(page.getByTestId(/^focus-ready-suggestion-star-/))
			.first();
		if (await star.isVisible().catch(() => false)) {
			await star.click();
		} else {
			await page
				.getByRole("button", {
					name: /Why this|See why|wyjaśnienie automatycznej sugestii/i,
				})
				.first()
				.click();
		}
	}

	await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByTestId("suggestion-accept-btn")).toBeVisible({
		timeout: 30_000,
	});

	if (options?.title != null) {
		await expect(page.getByTestId("suggestion-task-title")).toHaveText(
			options.title,
		);
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
