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

/** After reload on idle dashboard — reset guard only (no countCompletedWork fetch). */
export async function resetCycleRecoveryAfterReload(page: Page) {
	await expect(page.getByTestId("task-list")).toBeVisible();
	await resetCycleRecoveryGuard(page);
}

async function fetchCountCompletedWork(
	page: Page,
	sessionId: number,
): Promise<number | null> {
	const encoded = encodeURIComponent(JSON.stringify({ json: { sessionId } }));
	const response = await page.request.get(
		`/api/trpc/cycle.countCompletedWork?input=${encoded}`,
	);
	if (!response.ok()) {
		return null;
	}
	const body = (await response.json()) as {
		result?: { data?: { json?: number } };
	};
	const count = body.result?.data?.json;
	return typeof count === "number" ? count : null;
}

async function pollCountCompletedWork(
	page: Page,
	sessionId: number,
	minCount = 0,
) {
	await expect
		.poll(
			async () => {
				const count = await fetchCountCompletedWork(page, sessionId);
				if (count == null || count < minCount) {
					return null;
				}
				return count;
			},
			{ timeout: 20_000 },
		)
		.not.toBeNull();
}

/**
 * After fatigue API seed — re-run cycle recovery and confirm server completed-work count.
 * Uses direct tRPC GET polling (not waitForResponse) because the React client fetches
 * countCompletedWork via httpBatchStreamLink POST where sessionId lives in the body.
 */
export async function rehydrateFatigueSeedState(page: Page, sessionId: number) {
	await resetCycleRecoveryGuard(page);
	await pollCountCompletedWork(page, sessionId);
}
