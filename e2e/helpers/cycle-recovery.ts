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

function sessionIdFromTrpcInput(input: unknown): number | undefined {
	if (Array.isArray(input)) {
		for (const item of input) {
			const sessionId = sessionIdFromTrpcInput(item);
			if (sessionId != null) {
				return sessionId;
			}
		}
		return undefined;
	}
	if (input && typeof input === "object" && "json" in input) {
		const json = (input as { json?: { sessionId?: number } }).json;
		if (typeof json?.sessionId === "number") {
			return json.sessionId;
		}
	}
	return undefined;
}

function parseSessionIdFromTrpcUrl(url: string): number | undefined {
	try {
		const parsed = new URL(url, "http://localhost");
		const input = parsed.searchParams.get("input");
		if (!input) {
			return undefined;
		}
		return sessionIdFromTrpcInput(JSON.parse(decodeURIComponent(input)));
	} catch {
		return undefined;
	}
}

function urlEncodesSessionId(url: string, sessionId: number): boolean {
	const parsedId = parseSessionIdFromTrpcUrl(url);
	if (parsedId === sessionId) {
		return true;
	}
	const decoded = decodeURIComponent(url);
	return new RegExp(`"sessionId"\\s*:\\s*${sessionId}\\b`).test(decoded);
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
	return urlEncodesSessionId(url, sessionId);
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

async function pollCountCompletedWork(page: Page, sessionId: number) {
	await expect
		.poll(
			async () => {
				const encoded = encodeURIComponent(
					JSON.stringify({ json: { sessionId } }),
				);
				const response = await page.request.get(
					`/api/trpc/cycle.countCompletedWork?input=${encoded}`,
				);
				if (!response.ok()) {
					return null;
				}
				const body = (await response.json()) as {
					result?: { data?: { json?: number } };
				};
				return body.result?.data?.json ?? null;
			},
			{ timeout: 20_000 },
		)
		.not.toBeNull();
}

/** After fatigue API seed — re-fetch completedWorkCycles for wind-down gate. */
export async function rehydrateFatigueSeedState(page: Page, sessionId: number) {
	const countPromise = waitForCountCompletedWork(page, sessionId);
	await resetCycleRecoveryGuard(page);
	try {
		await countPromise;
	} catch {
		// countCompletedWork may have fired during reload before the listener registered.
		await pollCountCompletedWork(page, sessionId);
	}
}
