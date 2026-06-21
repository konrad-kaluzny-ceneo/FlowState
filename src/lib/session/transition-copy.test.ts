import { describe, expect, it } from "vitest";

import type { EnergyLevel } from "~/lib/domain/energy-level";
import {
	BREAK_REENTRY_FADING,
	BREAK_REENTRY_FOCUSED,
	BREAK_REENTRY_NEUTRAL,
	BREAK_REENTRY_STEADY,
	BREAK_START_LONG,
	BREAK_START_SHORT,
	BREAK_TRANSITION_VISIBLE_MS,
	getBreakReentryLine,
	getBreakStartLine,
} from "~/lib/session/transition-copy";
import { WIND_DOWN_BODY, WIND_DOWN_TITLE } from "~/lib/session/wind-down-copy";

const PREACHY_PATTERN = /should|mistake|wrong|must stop|give up/i;
const WIND_DOWN_THEME = /wrap up|ending now|valid choice|been at it/i;

describe("transition-copy", () => {
	describe("getBreakStartLine", () => {
		it("returns short-break copy for SHORT_BREAK", () => {
			expect(getBreakStartLine("SHORT_BREAK")).toBe(BREAK_START_SHORT);
		});

		it("returns long-break copy for LONG_BREAK", () => {
			expect(getBreakStartLine("LONG_BREAK")).toBe(BREAK_START_LONG);
		});

		it("uses calm tone without preachy language", () => {
			for (const line of [BREAK_START_SHORT, BREAK_START_LONG]) {
				expect(line).not.toMatch(PREACHY_PATTERN);
				expect(line.length).toBeGreaterThan(10);
			}
		});
	});

	describe("getBreakReentryLine", () => {
		it.each([
			["FOCUSED", BREAK_REENTRY_FOCUSED],
			["STEADY", BREAK_REENTRY_STEADY],
			["FADING", BREAK_REENTRY_FADING],
		] as const satisfies readonly [
			EnergyLevel,
			string,
		][])("returns energy-keyed copy for %s", (energy, expected) => {
			expect(getBreakReentryLine(energy)).toBe(expected);
		});

		it("returns neutral fallback when energy is null", () => {
			expect(getBreakReentryLine(null)).toBe(BREAK_REENTRY_NEUTRAL);
		});

		it("uses calm tone without preachy language", () => {
			for (const line of [
				BREAK_REENTRY_FOCUSED,
				BREAK_REENTRY_STEADY,
				BREAK_REENTRY_FADING,
				BREAK_REENTRY_NEUTRAL,
			]) {
				expect(line).not.toMatch(PREACHY_PATTERN);
			}
		});

		it("keeps Fading re-entry distinct from S-16 wind-down copy", () => {
			expect(BREAK_REENTRY_FADING).not.toMatch(WIND_DOWN_THEME);
			expect(BREAK_REENTRY_FADING).not.toContain(WIND_DOWN_TITLE);
			expect(BREAK_REENTRY_FADING).not.toContain(WIND_DOWN_BODY);
		});
	});

	it("auto-dismiss window is at least five seconds", () => {
		expect(BREAK_TRANSITION_VISIBLE_MS).toBeGreaterThanOrEqual(5_000);
	});
});
