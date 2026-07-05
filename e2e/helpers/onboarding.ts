import { expect, type Page } from "@playwright/test";

export const ONBOARDING_KEY_GUEST = "flowstate:onboarding:guest";

export async function clearOnboardingKeys(page: Page) {
	await page.evaluate(() => {
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith("flowstate:onboarding:")) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
		sessionStorage.removeItem("flowstate:merge-success-pending");
		sessionStorage.removeItem("flowstate:guest-import-done");
		sessionStorage.removeItem("flowstate:guest-import-attempted");
	});
}

export async function seedOnboardingDismissed(page: Page, userId?: string) {
	const key = userId ? `flowstate:onboarding:${userId}` : ONBOARDING_KEY_GUEST;
	await page.evaluate((storageKey) => {
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				v: 1,
				firstRunDismissed: true,
				checkInCoachSeen: false,
				suggestionCoachSeen: false,
				presetCoachDismissed: true,
			}),
		);
	}, key);
}

export async function dismissMergeSuccessIfVisible(
	page: Page,
	options?: { appearTimeoutMs?: number },
) {
	const overlay = page.getByTestId("merge-success-overlay");
	if (options?.appearTimeoutMs != null) {
		await overlay
			.waitFor({ state: "visible", timeout: options.appearTimeoutMs })
			.catch(() => {});
	}
	if (!(await overlay.isVisible().catch(() => false))) {
		return;
	}
	await page.getByTestId("merge-success-dismiss-btn").click();
	await expect(overlay).toBeHidden({ timeout: 10_000 });
}

export async function dismissFirstRunIfVisible(page: Page) {
	for (let attempt = 0; attempt < 3; attempt++) {
		await dismissMergeSuccessIfVisible(page);

		const mergeOverlay = page.getByTestId("merge-success-overlay");
		if (await mergeOverlay.isVisible().catch(() => false)) {
			continue;
		}

		const overlay = page.getByTestId("first-run-overlay");
		if (!(await overlay.isVisible().catch(() => false))) {
			return;
		}
		await page.getByTestId("first-run-dismiss-btn").click();
		try {
			await expect(overlay).toBeHidden({ timeout: 5000 });
			return;
		} catch {
			// Merge-success may appear asynchronously after import — retry.
		}
	}
	await expect(page.getByTestId("first-run-overlay")).toBeHidden({
		timeout: 10_000,
	});
}

export async function dismissAuthOnboardingIfNeeded(page: Page) {
	await clearOnboardingKeys(page);
	const authKey = await findAuthOnboardingKey(page);
	if (authKey != null) {
		const userId = authKey.replace("flowstate:onboarding:", "");
		await seedOnboardingDismissed(page, userId);
	} else {
		await seedOnboardingDismissed(page);
	}
	await dismissFirstRunIfVisible(page);
}

export async function findAuthOnboardingKey(
	page: Page,
): Promise<string | null> {
	return page.evaluate(() => {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (
				key?.startsWith("flowstate:onboarding:") &&
				key !== "flowstate:onboarding:guest"
			) {
				return key;
			}
		}
		return null;
	});
}

export async function getOnboardingStateFromStorage(
	page: Page,
	key: string,
): Promise<{ firstRunDismissed?: boolean } | null> {
	return page.evaluate((storageKey) => {
		const raw = localStorage.getItem(storageKey);
		if (raw == null) {
			return null;
		}
		return JSON.parse(raw) as { firstRunDismissed?: boolean };
	}, key);
}
