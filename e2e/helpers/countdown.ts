import { expect, type Locator } from "@playwright/test";

import {
	expectedRemainingSec,
	parseCountdownToSeconds,
} from "../../src/test-utils/countdown-tolerance";

export async function expectCountdownWithinTolerance(
	countdown: Locator,
	endTimeMs: number,
	toleranceSec = 2,
	nowMs?: number,
): Promise<void> {
	const text = (await countdown.textContent()) ?? "";
	const actualSec = parseCountdownToSeconds(text);
	const expectedSec = expectedRemainingSec(endTimeMs, nowMs);
	expect(Math.abs(actualSec - expectedSec)).toBeLessThanOrEqual(toleranceSec);
}

export async function expectCountdownSecondsNear(
	countdown: Locator,
	expectedSec: number,
	toleranceSec = 2,
): Promise<void> {
	const text = (await countdown.textContent()) ?? "";
	const actualSec = parseCountdownToSeconds(text);
	expect(Math.abs(actualSec - expectedSec)).toBeLessThanOrEqual(toleranceSec);
}
