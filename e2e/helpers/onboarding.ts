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
			}),
		);
	}, key);
}

export async function dismissFirstRunIfVisible(page: Page) {
	const overlay = page.getByTestId("first-run-overlay");
	if (await overlay.isVisible()) {
		await page.getByTestId("first-run-dismiss-btn").click();
		await expect(overlay).toBeHidden();
	}
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
