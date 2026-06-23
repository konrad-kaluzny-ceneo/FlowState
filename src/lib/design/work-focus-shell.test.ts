import { describe, expect, it } from "vitest";

import { shouldShowWorkFocusShell } from "./work-focus-shell";

describe("shouldShowWorkFocusShell", () => {
	const base = {
		cycleKind: "WORK" as const,
		state: "running" as const,
		wedgeGateActive: false,
	};

	it("is active during running WORK cycle", () => {
		expect(shouldShowWorkFocusShell(base)).toBe(true);
	});

	it("is active during paused WORK cycle", () => {
		expect(shouldShowWorkFocusShell({ ...base, state: "paused" })).toBe(true);
	});

	it("is inactive when idle", () => {
		expect(shouldShowWorkFocusShell({ ...base, state: "idle" })).toBe(false);
	});

	it("is inactive when completed", () => {
		expect(shouldShowWorkFocusShell({ ...base, state: "completed" })).toBe(
			false,
		);
	});

	it("is inactive during breaks", () => {
		expect(
			shouldShowWorkFocusShell({
				...base,
				cycleKind: "SHORT_BREAK",
			}),
		).toBe(false);
	});

	it("yields when wedge gate is active", () => {
		expect(shouldShowWorkFocusShell({ ...base, wedgeGateActive: true })).toBe(
			false,
		);
	});
});
