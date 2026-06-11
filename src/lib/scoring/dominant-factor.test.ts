import { describe, expect, it } from "vitest";

import {
	getDominantRationaleKey,
	getFactorContributions,
} from "./dominant-factor";
import type { ScoringContext, ScoringTask } from "./score-task";

const baseTask: ScoringTask = {
	id: 1,
	workType: "DEEP_WORK",
	weight: 3,
	importance: 2,
	urgency: 3,
	effortMinutes: null,
	commitmentHorizon: "WHEN_POSSIBLE",
	sortOrder: 0,
	createdAt: new Date("2026-01-01"),
};

const baseContext: ScoringContext = {
	energy: "FOCUSED",
	completedWorkCycles: 0,
	interruptionCount: 0,
	localHour: 10,
};

describe("getFactorContributions", () => {
	it("returns sorted contributions with energy_deep for focused deep work", () => {
		const contributions = getFactorContributions(baseTask, baseContext);
		expect(contributions[0]).toMatchObject({
			key: "energy_deep",
			magnitude: 1.5,
		});
		expect(contributions.every((c) => c.magnitude >= 0)).toBe(true);
	});
});

describe("getDominantRationaleKey", () => {
	it("returns energy_deep for focused deep work", () => {
		expect(getDominantRationaleKey(baseTask, baseContext)).toBe("energy_deep");
	});

	it("returns late_day for operational work late in the day after cycles", () => {
		const task: ScoringTask = { ...baseTask, workType: "OPERATIONAL" };
		const context: ScoringContext = {
			...baseContext,
			completedWorkCycles: 2,
			localHour: 18,
		};
		expect(getDominantRationaleKey(task, context)).toBe("late_day");
	});

	it("returns energy_light when fading energy dominates", () => {
		const task: ScoringTask = { ...baseTask, workType: "REACTIVE" };
		const context: ScoringContext = {
			...baseContext,
			energy: "FADING",
			completedWorkCycles: 4,
			lastOverrideWorkType: "REACTIVE",
		};
		expect(getDominantRationaleKey(task, context)).toBe("energy_light");
	});

	it("returns energy_light for steady operational work with positive energy fit", () => {
		const task: ScoringTask = {
			...baseTask,
			workType: "OPERATIONAL",
			weight: 2,
		};
		const context: ScoringContext = { ...baseContext, energy: "STEADY" };
		expect(getDominantRationaleKey(task, context)).toBe("energy_light");
	});

	it("returns default when all factor magnitudes are zero", () => {
		const task: ScoringTask = {
			...baseTask,
			workType: "OPERATIONAL",
			weight: 2,
		};
		expect(getDominantRationaleKey(task, baseContext)).toBe("default");
	});

	it("returns override_preference when last override matches task work type", () => {
		const task: ScoringTask = {
			...baseTask,
			workType: "OPERATIONAL",
			weight: 2,
		};
		const context: ScoringContext = {
			...baseContext,
			lastOverrideWorkType: "OPERATIONAL",
		};
		expect(getDominantRationaleKey(task, context)).toBe("override_preference");
	});
});
