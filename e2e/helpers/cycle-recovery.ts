import { expect, type Page } from "@playwright/test";

declare global {
	interface Window {
		__flowstateResetCycleRecovery?: () => void;
	}
}

/** Re-run recoverActiveCycle after reload (dev HMR keeps module-level recovery guard). */
export async function resetCycleRecoveryGuard(page: Page) {
	await expect
		.poll(
			async () =>
				page.evaluate(
					() => typeof window.__flowstateResetCycleRecovery === "function",
				),
			{ timeout: 15_000 },
		)
		.toBe(true);
	await page.evaluate(() => {
		window.__flowstateResetCycleRecovery?.();
	});
}

function parseSessionIdFromTrpcUrl(url: string): number | undefined {
	try {
		const parsed = new URL(url, "http://localhost");
		const input = parsed.searchParams.get("input");
		if (!input) {
			return undefined;
		}
		const decoded = JSON.parse(decodeURIComponent(input)) as {
			json?: { sessionId?: number };
		};
		return decoded.json?.sessionId;
	} catch {
		return undefined;
	}
}

function countCompletedWorkResponseMatches(
	response: { url: () => string; ok: () => boolean },
	sessionId?: number,
) {
	const url = response.url();
	if (!url.includes("cycle.countCompletedWork") || !response.ok()) {
		return false;
	}
	if (sessionId == null) {
		return true;
	}
	return parseSessionIdFromTrpcUrl(url) === sessionId;
}

export function waitForCountCompletedWork(page: Page, sessionId?: number) {
	return page.waitForResponse(
		(response) => countCompletedWorkResponseMatches(response, sessionId),
		{ timeout: 20_000 },
	);
}

/** After reload on idle dashboard — reset guard only (no countCompletedWork fetch). */
export async function resetCycleRecoveryAfterReload(page: Page) {
	await expect(page.getByTestId("task-list")).toBeVisible();
	await resetCycleRecoveryGuard(page);
}

/** After fatigue API seed — re-fetch completedWorkCycles for wind-down gate. */
export async function rehydrateFatigueSeedState(page: Page, sessionId: number) {
	await resetCycleRecoveryGuard(page);
	await waitForCountCompletedWork(page, sessionId);
}
