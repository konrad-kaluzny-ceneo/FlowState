import {
	type APIRequestContext,
	type Page,
	test as base,
	expect,
} from "@playwright/test";

import { createTestUser, signInAsUser } from "./helpers/user";

async function authenticatePage(page: Page, request: APIRequestContext) {
	const user = await createTestUser(request);
	const state = await signInAsUser(request, user);
	await page.context().addCookies(state.cookies);
	for (const origin of state.origins) {
		if (origin.localStorage.length === 0) continue;
		await page.goto("/");
		await page.evaluate((items) => {
			for (const { name, value } of items) {
				localStorage.setItem(name, value);
			}
		}, origin.localStorage);
		break;
	}
}

/** Auth specs: fresh API user per test (no shared storageState). */
export const test = base.extend({
	page: async ({ page, request }, use) => {
		await authenticatePage(page, request);
		await use(page);
	},
});

export { expect };

export async function waitForCycleGetActive(page: Page) {
	await page.waitForResponse(
		(response) =>
			response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
}
