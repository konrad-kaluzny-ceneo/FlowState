import { describe, expect, it } from "vitest";

import { shouldShowBreakAtmosphere } from "./break-atmosphere";

const base = {
	cycleKind: "SHORT_BREAK" as const,
	state: "running" as const,
	wedgeGateActive: false,
};

describe("shouldShowBreakAtmosphere", () => {
	it("is true during running short break without gates", () => {
		expect(shouldShowBreakAtmosphere(base)).toBe(true);
	});

	it("is true during paused long break", () => {
		expect(
			shouldShowBreakAtmosphere({
				...base,
				cycleKind: "LONG_BREAK",
				state: "paused",
			}),
		).toBe(true);
	});

	it("is false during work cycle", () => {
		expect(shouldShowBreakAtmosphere({ ...base, cycleKind: "WORK" })).toBe(
			false,
		);
	});

	it("is false when wedge gate active", () => {
		expect(shouldShowBreakAtmosphere({ ...base, wedgeGateActive: true })).toBe(
			false,
		);
	});

	it("is false when idle on break kind", () => {
		expect(shouldShowBreakAtmosphere({ ...base, state: "idle" })).toBe(false);
	});
});
