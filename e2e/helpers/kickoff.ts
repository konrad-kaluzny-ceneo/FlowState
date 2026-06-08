import { expect, type Page } from "@playwright/test";

export async function waitForKickoffSuggestion(page: Page) {
	await page.waitForResponse(
		(response) => {
			if (!response.url().includes("suggestion.next") || !response.ok()) {
				return false;
			}
			const postData = response.request().postData();
			return postData?.includes('"context":"kickoff"') ?? false;
		},
		{ timeout: 20_000 },
	);
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
