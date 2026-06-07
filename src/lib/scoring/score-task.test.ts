import { describe, expect, it } from "vitest";

import { pickBestTask, type ScoringContext, scoreTask } from "./score-task";

const baseContext: ScoringContext = {
	energy: "FOCUSED",
	completedWorkCycles: 0,
	interruptionCount: 0,
	localHour: 10,
};

describe("scoreTask", () => {
	it("returns null for empty task list", () => {
		expect(pickBestTask([], baseContext)).toBeNull();
	});

	it("returns the only task when one candidate", () => {
		const task = {
			id: 1,
			workType: "OPERATIONAL" as const,
			weight: 2,
			createdAt: new Date("2026-01-01"),
		};
		expect(pickBestTask([task], baseContext)).toEqual(task);
	});

	it("prefers DEEP_WORK heavy when FOCUSED and fresh session", () => {
		const deep = {
			id: 1,
			workType: "DEEP_WORK" as const,
			weight: 3,
			createdAt: new Date("2026-01-01"),
		};
		const reactive = {
			id: 2,
			workType: "REACTIVE" as const,
			weight: 3,
			createdAt: new Date("2026-01-02"),
		};
		expect(pickBestTask([reactive, deep], baseContext)?.id).toBe(1);
		expect(scoreTask(deep, baseContext)).toBeGreaterThan(
			scoreTask(reactive, baseContext),
		);
	});

	it("prefers lighter work when FADING after many cycles", () => {
		const context: ScoringContext = {
			...baseContext,
			energy: "FADING",
			completedWorkCycles: 4,
		};
		const deep = {
			id: 1,
			workType: "DEEP_WORK" as const,
			weight: 3,
			createdAt: new Date("2026-01-01"),
		};
		const reactive = {
			id: 2,
			workType: "REACTIVE" as const,
			weight: 2,
			createdAt: new Date("2026-01-02"),
		};
		expect(pickBestTask([deep, reactive], context)?.id).toBe(2);
	});

	it("prefers reactive work over deep work after interruptions", () => {
		const context: ScoringContext = {
			...baseContext,
			interruptionCount: 4,
		};
		const deep = {
			id: 1,
			workType: "DEEP_WORK" as const,
			weight: 2,
			createdAt: new Date("2026-01-01"),
		};
		const reactive = {
			id: 2,
			workType: "REACTIVE" as const,
			weight: 3,
			createdAt: new Date("2026-01-02"),
		};
		expect(pickBestTask([deep, reactive], context)?.id).toBe(2);
	});

	it("tie-breaks on higher weight then earlier createdAt", () => {
		const heavier = {
			id: 1,
			workType: "OPERATIONAL" as const,
			weight: 3,
			createdAt: new Date("2026-01-02"),
		};
		const lighter = {
			id: 2,
			workType: "OPERATIONAL" as const,
			weight: 2,
			createdAt: new Date("2026-01-01"),
		};
		expect(pickBestTask([lighter, heavier], baseContext)?.id).toBe(1);
	});

	it("override boost can change winner when scores are close", () => {
		const operational = {
			id: 1,
			workType: "OPERATIONAL" as const,
			weight: 2,
			createdAt: new Date("2026-01-01"),
		};
		const reactive = {
			id: 2,
			workType: "REACTIVE" as const,
			weight: 2,
			createdAt: new Date("2026-01-02"),
		};
		const fadingContext = {
			...baseContext,
			energy: "FADING" as const,
		};
		const withoutOverride = pickBestTask(
			[operational, reactive],
			fadingContext,
		);
		const withOverride = pickBestTask([operational, reactive], {
			...fadingContext,
			lastOverrideWorkType: "OPERATIONAL",
		});
		expect(withoutOverride?.id).toBe(2);
		expect(withOverride?.id).toBe(1);
	});
});
