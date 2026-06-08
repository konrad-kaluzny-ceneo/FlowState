import { expect, type Page } from "@playwright/test";

function suggestionNextPostDataIncludes(
	response: {
		url: () => string;
		ok: () => boolean;
		request: () => { postData: () => string | null };
	},
	context: "post_check_in" | "kickoff",
) {
	if (!response.url().includes("suggestion.next") || !response.ok()) {
		return false;
	}
	const postData = response.request().postData();
	if (postData == null) {
		return false;
	}
	if (context === "post_check_in") {
		return postData.includes("post_check_in") && postData.includes("cycleId");
	}
	return postData.includes("kickoff") && postData.includes("sessionId");
}

export async function waitForSuggestionNext(page: Page) {
	await page.waitForResponse(
		(response) => suggestionNextPostDataIncludes(response, "post_check_in"),
		{ timeout: 20_000 },
	);
	await expect(page.getByTestId("timer-panel-running")).toContainText("Break", {
		timeout: 15_000,
	});
}

export async function expectSuggestionVisible(
	page: Page,
	options?: {
		title?: string;
		rationale?: RegExp | string;
		expectCoach?: boolean;
	},
) {
	const coachLine = page.getByTestId("suggestion-coach-line");

	await expect(page.getByTestId("task-suggestion-card")).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByTestId("suggestion-accept-btn")).toBeVisible({
		timeout: 30_000,
	});

	if (options?.expectCoach === true) {
		await expect(coachLine).toBeVisible({ timeout: 20_000 });
	} else if (options?.expectCoach === false) {
		await expect(coachLine).toBeHidden();
	}

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
