import { describe, expect, it } from "vitest";

import {
	resolveIllustrationEnergyTint,
	resolveIllustrationVariant,
} from "./illustration-variant";

const base = {
	state: "idle" as const,
	narrativeLatestEnergy: null,
	recentlyClosedSession: false,
	wedgeGateActive: false,
};

describe("resolveIllustrationVariant", () => {
	it("resolves idle for idle state", () => {
		expect(resolveIllustrationVariant(base)).toBe("idle");
	});

	it("resolves energy_choice for steering state", () => {
		expect(resolveIllustrationVariant({ ...base, state: "steering" })).toBe(
			"energy_choice",
		);
	});

	it("resolves work for active_work state", () => {
		expect(resolveIllustrationVariant({ ...base, state: "active_work" })).toBe(
			"work",
		);
	});

	it("resolves break for break state", () => {
		expect(resolveIllustrationVariant({ ...base, state: "break" })).toBe(
			"break",
		);
	});

	it("resolves return for returning state", () => {
		expect(resolveIllustrationVariant({ ...base, state: "returning" })).toBe(
			"return",
		);
	});

	it("resolves closure when recentlyClosedSession is true, regardless of state", () => {
		expect(
			resolveIllustrationVariant({
				...base,
				state: "active_work",
				recentlyClosedSession: true,
			}),
		).toBe("closure");
	});

	it("prioritizes closure over every other state value", () => {
		const states = [
			"idle",
			"steering",
			"active_work",
			"break",
			"returning",
		] as const;
		for (const state of states) {
			expect(
				resolveIllustrationVariant({
					...base,
					state,
					recentlyClosedSession: true,
				}),
			).toBe("closure");
		}
	});
});

describe("resolveIllustrationEnergyTint", () => {
	it("is null for idle", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "idle",
				narrativeLatestEnergy: "FOCUSED",
			}),
		).toBeNull();
	});

	it("is null for break", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "break",
				narrativeLatestEnergy: "FOCUSED",
			}),
		).toBeNull();
	});

	it("is null for return", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "returning",
				narrativeLatestEnergy: "FOCUSED",
			}),
		).toBeNull();
	});

	it("is null for closure", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "idle",
				recentlyClosedSession: true,
				narrativeLatestEnergy: "FOCUSED",
			}),
		).toBeNull();
	});

	it("carries the energy level for work", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "active_work",
				narrativeLatestEnergy: "FOCUSED",
			}),
		).toBe("FOCUSED");
	});

	it("carries the energy level for energy_choice", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "steering",
				narrativeLatestEnergy: "STEADY",
			}),
		).toBe("STEADY");
	});

	it("is null for work when narrativeLatestEnergy is null", () => {
		expect(
			resolveIllustrationEnergyTint({
				...base,
				state: "active_work",
				narrativeLatestEnergy: null,
			}),
		).toBeNull();
	});
});
