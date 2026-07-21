import { describe, expect, it } from "vitest";
import {
	isBreakKind,
	LONG_BREAK_CADENCE,
	resolveBreakCadenceSuggestion,
} from "~/lib/cycle/break-cadence";

describe("resolveBreakCadenceSuggestion", () => {
	it("suggests a short break for the first three breaks of a run", () => {
		expect(resolveBreakCadenceSuggestion(0)).toBe("SHORT_BREAK");
		expect(resolveBreakCadenceSuggestion(1)).toBe("SHORT_BREAK");
		expect(resolveBreakCadenceSuggestion(2)).toBe("SHORT_BREAK");
	});

	it("suggests a long break on the cadence boundary", () => {
		expect(resolveBreakCadenceSuggestion(LONG_BREAK_CADENCE - 1)).toBe(
			"LONG_BREAK",
		);
	});

	it("keeps suggesting a long break past the boundary", () => {
		expect(resolveBreakCadenceSuggestion(LONG_BREAK_CADENCE)).toBe(
			"LONG_BREAK",
		);
		expect(resolveBreakCadenceSuggestion(9)).toBe("LONG_BREAK");
	});

	it("does not suggest a long break for a negative counter", () => {
		expect(resolveBreakCadenceSuggestion(-1)).toBe("SHORT_BREAK");
	});
});

describe("isBreakKind", () => {
	it("is true for both break kinds", () => {
		expect(isBreakKind("SHORT_BREAK")).toBe(true);
		expect(isBreakKind("LONG_BREAK")).toBe(true);
	});

	it("is false for work and for no active cycle", () => {
		expect(isBreakKind("WORK")).toBe(false);
		expect(isBreakKind(null)).toBe(false);
	});
});
