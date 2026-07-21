import { describe, expect, it } from "vitest";
import { cycleEndTimeMs, pausedRemainingMs } from "~/lib/cycle/end-time";

const NOW = 1_800_000_000_000;
const STARTED_AT = new Date(NOW - 60_000);

describe("cycleEndTimeMs", () => {
	it("anchors expiry to the server startedAt by default", () => {
		expect(
			cycleEndTimeMs(
				{ startedAt: STARTED_AT, configuredDurationSec: 1500 },
				{ now: NOW, clientTimer: false },
			),
		).toBe(STARTED_AT.getTime() + 1_500_000);
	});

	it("measures from now under the E2E client timer", () => {
		expect(
			cycleEndTimeMs(
				{ startedAt: STARTED_AT, configuredDurationSec: 1500 },
				{ now: NOW, clientTimer: true },
			),
		).toBe(NOW + 1_500_000);
	});

	it("restarts a paused cycle from its frozen remainder", () => {
		expect(
			cycleEndTimeMs(
				{
					startedAt: STARTED_AT,
					configuredDurationSec: 1500,
					state: "PAUSED",
					remainingDurationSec: 300,
				},
				{ now: NOW, clientTimer: false },
			),
		).toBe(NOW + 300_000);
	});

	it("prefers the frozen remainder over the client timer when paused", () => {
		expect(
			cycleEndTimeMs(
				{
					startedAt: STARTED_AT,
					configuredDurationSec: 1500,
					state: "PAUSED",
					remainingDurationSec: 300,
				},
				{ now: NOW, clientTimer: true },
			),
		).toBe(NOW + 300_000);
	});

	it("falls back to the configured duration when a paused cycle has no remainder", () => {
		expect(
			cycleEndTimeMs(
				{
					startedAt: STARTED_AT,
					configuredDurationSec: 1500,
					state: "PAUSED",
					remainingDurationSec: null,
				},
				{ now: NOW, clientTimer: false },
			),
		).toBe(STARTED_AT.getTime() + 1_500_000);
	});

	it("ignores a remainder on a running cycle", () => {
		expect(
			cycleEndTimeMs(
				{
					startedAt: STARTED_AT,
					configuredDurationSec: 1500,
					state: "RUNNING",
					remainingDurationSec: 300,
				},
				{ now: NOW, clientTimer: false },
			),
		).toBe(STARTED_AT.getTime() + 1_500_000);
	});

	it("defaults `now` to the ambient clock", () => {
		const before = Date.now();
		const endTime = cycleEndTimeMs(
			{
				startedAt: STARTED_AT,
				configuredDurationSec: 1500,
				state: "PAUSED",
				remainingDurationSec: 60,
			},
			{ clientTimer: false },
		);

		expect(endTime).toBeGreaterThanOrEqual(before + 60_000);
		expect(endTime).toBeLessThanOrEqual(Date.now() + 60_000);
	});
});

describe("pausedRemainingMs", () => {
	it("converts the frozen remainder to ms", () => {
		expect(pausedRemainingMs({ remainingDurationSec: 90 })).toBe(90_000);
	});

	it("treats a missing remainder as zero", () => {
		expect(pausedRemainingMs({})).toBe(0);
		expect(pausedRemainingMs({ remainingDurationSec: null })).toBe(0);
	});

	it("clamps a negative remainder to zero", () => {
		expect(pausedRemainingMs({ remainingDurationSec: -30 })).toBe(0);
	});
});
