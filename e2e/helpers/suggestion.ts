import { expect, type Page } from "@playwright/test";

export async function waitForSuggestionNext(page: Page) {
	await page.waitForResponse(
		(response) => response.url().includes("suggestion.next") && response.ok(),
		{ timeout: 20_000 },
	);
}

export async function expectSuggestionVisible(
	page: Page,
	options?: { title?: string; rationale?: RegExp | string },
) {
	await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByTestId("suggestion-accept-btn")).toBeVisible({
		timeout: 20_000,
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

export async function acceptSuggestion(page: Page) {
	await expect(page.getByTestId("suggestion-accept-btn")).toBeEnabled();
	await page.getByTestId("suggestion-accept-btn").click();
}
