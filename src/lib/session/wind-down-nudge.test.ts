import { describe, expect, it } from "vitest";

import {
	buildWindDownRationale,
	shouldShowWindDownNudge,
	type WindDownInput,
} from "./wind-down-nudge";

const baseInput: WindDownInput = {
	energy: "FADING",
	completedWorkCycles: 0,
	interruptionCount: 0,
	dismissed: false,
};

describe("shouldShowWindDownNudge", () => {
	it("triggers when Fading with fatigue signal (completedWorkCycles >= 3)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, completedWorkCycles: 3 }),
		).toBe(true);
	});

	it("triggers when Fading with interruption signal (interruptionCount >= 2)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, interruptionCount: 2 }),
		).toBe(true);
	});

	it("does not trigger for Fading alone without fatigue or interruptions", () => {
		expect(
			shouldShowWindDownNudge({
				...baseInput,
				completedWorkCycles: 1,
				interruptionCount: 1,
			}),
		).toBe(false);
	});

	it.each([
		"STEADY",
		"FOCUSED",
	] as const)("does not trigger for %s energy even with fatigue", (energy) => {
		expect(
			shouldShowWindDownNudge({
				...baseInput,
				energy,
				completedWorkCycles: 4,
			}),
		).toBe(false);
	});

	it("suppresses when dismissed is true", () => {
		expect(
			shouldShowWindDownNudge({
				...baseInput,
				completedWorkCycles: 3,
				dismissed: true,
			}),
		).toBe(false);
	});

	it("triggers at fatigue boundary (completedWorkCycles === 3)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, completedWorkCycles: 3 }),
		).toBe(true);
	});

	it("does not trigger below fatigue boundary (completedWorkCycles === 2)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, completedWorkCycles: 2 }),
		).toBe(false);
	});

	it("triggers at interruption boundary (interruptionCount === 2)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, interruptionCount: 2 }),
		).toBe(true);
	});

	it("does not trigger below interruption boundary (interruptionCount === 1)", () => {
		expect(
			shouldShowWindDownNudge({ ...baseInput, interruptionCount: 1 }),
		).toBe(false);
	});
});

describe("buildWindDownRationale", () => {
	it("returns fatigue rationale when completedWorkCycles >= 3", () => {
		expect(
			buildWindDownRationale({ ...baseInput, completedWorkCycles: 3 }),
		).toBe("Light admin — energy dipping after 4 cycles");
	});

	it("returns interruptions rationale when only interruption signal qualifies", () => {
		expect(
			buildWindDownRationale({
				...baseInput,
				completedWorkCycles: 1,
				interruptionCount: 2,
			}),
		).toBe("Reactive work — session had several interruptions");
	});

	it("prefers fatigue rationale when both fatigue and interruption signals present", () => {
		expect(
			buildWindDownRationale({
				...baseInput,
				completedWorkCycles: 3,
				interruptionCount: 3,
			}),
		).toBe("Light admin — energy dipping after 4 cycles");
	});
});
