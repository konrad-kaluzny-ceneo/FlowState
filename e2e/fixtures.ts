import fs from "node:fs";
import path from "node:path";

import { test as base, expect } from "@playwright/test";

import { AUTH_POOL_SIZE } from "./env";

const AUTH_DIR = path.join(import.meta.dirname, ".auth");

/** Auth specs: worker-scoped storageState from global-setup auth pool. */
export const test = base.extend({
	context: async ({ browser }, use, testInfo) => {
		const workerSlot = testInfo.workerIndex % AUTH_POOL_SIZE;
		const storageState = path.join(AUTH_DIR, `worker-${workerSlot}.json`);
		if (!fs.existsSync(storageState)) {
			throw new Error(
				`Missing auth state at ${storageState}. Re-run Playwright (global-setup provisions the worker auth pool).`,
			);
		}
		const context = await browser.newContext({ storageState });
		await use(context);
		await context.close();
	},
});

export { expect };

export async function waitForCycleGetActive(
	page: import("@playwright/test").Page,
) {
	await page.waitForResponse(
		(response) => response.url().includes("cycle.getActive") && response.ok(),
		{ timeout: 20_000 },
	);
}
