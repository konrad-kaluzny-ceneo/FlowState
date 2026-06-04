import { expect } from "vitest";

import { formatRemainingMs } from "~/lib/format-remaining";

const COUNTDOWN_PATTERN = /^(\d{2}):(\d{2})$/;

export function parseCountdownToSeconds(text: string): number {
	const match = COUNTDOWN_PATTERN.exec(text.trim());
	if (match == null) {
		throw new Error(`Invalid countdown format: "${text}"`);
	}
	return Number.parseInt(match[1]!, 10) * 60 + Number.parseInt(match[2]!, 10);
}

export function expectedRemainingSec(
	endTimeMs: number,
	nowMs: number = Date.now(),
): number {
	return Math.max(0, Math.ceil((endTimeMs - nowMs) / 1000));
}

export function expectedCountdownDisplay(
	endTimeMs: number,
	nowMs: number = Date.now(),
): string {
	return formatRemainingMs(Math.max(0, endTimeMs - nowMs));
}

export function assertCountdownWithinTolerance(
	actualText: string,
	endTimeMs: number,
	toleranceSec = 2,
	nowMs?: number,
): void {
	const actualSec = parseCountdownToSeconds(actualText);
	const expectedSec = expectedRemainingSec(endTimeMs, nowMs);
	expect(Math.abs(actualSec - expectedSec)).toBeLessThanOrEqual(toleranceSec);
}

export function assertRemainingMsWithinTolerance(
	remainingMs: number,
	endTimeMs: number,
	toleranceMs = 2000,
	nowMs?: number,
): void {
	const now = nowMs ?? Date.now();
	const expectedMs = Math.max(0, endTimeMs - now);
	expect(Math.abs(remainingMs - expectedMs)).toBeLessThanOrEqual(toleranceMs);
}
