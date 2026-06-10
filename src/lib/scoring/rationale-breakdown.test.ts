import { describe, expect, it } from "vitest";

import { buildRationale } from "./rationale";
import {
	buildRationaleBreakdown,
	FACTOR_CHIP_LABELS,
} from "./rationale-breakdown";
import type { ScoringContext, ScoringTask } from "./score-task";

const deepTask: ScoringTask = {
	id: 1,
	workType: "DEEP_WORK",
	weight: 3,
	sortOrder: 0,
	createdAt: new Date("2026-01-01"),
};

const operationalTask: ScoringTask = {
	id: 2,
	workType: "OPERATIONAL",
	weight: 3,
	sortOrder: 0,
	createdAt: new Date("2026-01-01"),
};

const reactiveTask: ScoringTask = {
	id: 3,
	workType: "REACTIVE",
	weight: 4,
	sortOrder: 0,
	createdAt: new Date("2026-01-01"),
};

describe("FACTOR_CHIP_LABELS", () => {
	it("maps both energy keys to a single Energy fit label", () => {
		expect(FACTOR_CHIP_LABELS.energy_deep).toBe("Energy fit");
		expect(FACTOR_CHIP_LABELS.energy_light).toBe("Energy fit");
	});
});

describe("buildRationaleBreakdown", () => {
	it("excludes headline factor from dominant secondary copy", () => {
		const context: ScoringContext = {
			energy: "FOCUSED",
			completedWorkCycles: 0,
			interruptionCount: 0,
			localHour: 10,
			lastOverrideWorkType: "DEEP_WORK",
		};
		const headline = buildRationale("energy_deep", context);

		const breakdown = buildRationaleBreakdown(deepTask, context, {
			headline,
			headlineKey: "energy_deep",
		});

		expect(breakdown.headline).toBe(headline);
		expect(breakdown.dominant).toHaveLength(1);
		expect(breakdown.dominant[0]?.key).toBe("override_preference");
		expect(breakdown.dominant[0]?.copy).not.toBe(headline);
	});

	it("lists up to three secondary dominant factors and chips for the remainder", () => {
		const context: ScoringContext = {
			energy: "FADING",
			completedWorkCycles: 4,
			interruptionCount: 0,
			localHour: 18,
			lastOverrideWorkType: "REACTIVE",
		};
		const headline = "Fresh session — here's a strong starting point";

		const breakdown = buildRationaleBreakdown(reactiveTask, context, {
			headline,
			headlineKey: "kickoff_fresh",
		});

		expect(breakdown.dominant.map((item) => item.key)).toEqual([
			"energy_light",
			"override_preference",
			"late_day",
		]);
		expect(breakdown.alsoConsidered).toEqual(["Cycles completed"]);
	});

	it("surfaces override preference in dominant when headline is kickoff-specific", () => {
		const context: ScoringContext = {
			energy: "FADING",
			completedWorkCycles: 0,
			interruptionCount: 0,
			localHour: 10,
			lastOverrideWorkType: "REACTIVE",
		};
		const headline = "Fresh session — here's a strong starting point";

		const breakdown = buildRationaleBreakdown(reactiveTask, context, {
			headline,
			headlineKey: "kickoff_fresh",
		});

		expect(
			breakdown.dominant.some((item) => item.key === "override_preference"),
		).toBe(true);
	});

	it("returns empty dominant and chips when all magnitudes are zero", () => {
		const context: ScoringContext = {
			energy: "FOCUSED",
			completedWorkCycles: 0,
			interruptionCount: 0,
			localHour: 10,
		};
		const headline = buildRationale("default", context);

		const breakdown = buildRationaleBreakdown(operationalTask, context, {
			headline,
			headlineKey: "default",
		});

		expect(breakdown.dominant).toEqual([]);
		expect(breakdown.alsoConsidered).toEqual([]);
	});

	it("dedupes energy chip labels in alsoConsidered", () => {
		const context: ScoringContext = {
			energy: "FADING",
			completedWorkCycles: 2,
			interruptionCount: 0,
			localHour: 18,
		};
		const headline = buildRationale("late_day", context);

		const breakdown = buildRationaleBreakdown(operationalTask, context, {
			headline,
			headlineKey: "late_day",
		});

		const energyFitCount = breakdown.alsoConsidered.filter(
			(label) => label === "Energy fit",
		).length;
		expect(energyFitCount).toBeLessThanOrEqual(1);
	});

	it("does not repeat one-liner copy in dominant when headlineKey matches top contribution", () => {
		const context: ScoringContext = {
			energy: "FOCUSED",
			completedWorkCycles: 0,
			interruptionCount: 0,
			localHour: 10,
		};
		const headline = buildRationale("energy_deep", context);

		const breakdown = buildRationaleBreakdown(deepTask, context, {
			headline,
			headlineKey: "energy_deep",
		});

		expect(breakdown.dominant.every((item) => item.copy !== headline)).toBe(
			true,
		);
	});
});
