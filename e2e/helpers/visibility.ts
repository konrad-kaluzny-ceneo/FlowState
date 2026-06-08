import type { Page } from "@playwright/test";

async function setPageVisibility(page: Page, state: DocumentVisibilityState) {
	await page.evaluate((visibility) => {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => visibility,
		});
	}, state);
}

/** Run `fn` while the tab is mocked hidden; restore visible and fire visibilitychange. */
export async function runWhileHidden(page: Page, fn: () => Promise<void>) {
	await setPageVisibility(page, "hidden");
	await page.evaluate(() => {
		document.dispatchEvent(new Event("visibilitychange"));
	});
	try {
		await fn();
	} finally {
		await setPageVisibility(page, "visible");
		await page.evaluate(() => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
	}
}
