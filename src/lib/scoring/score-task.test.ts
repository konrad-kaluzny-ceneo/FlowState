import { describe, expect, it } from "vitest";

import {
	computeEisenhowerBase,
	pickBestTask,
	type ScoringContext,
	type ScoringTask,
	scoreTask,
} from "./score-task";

const baseContext: ScoringContext = {
	energy: "FOCUSED",
	completedWorkCycles: 0,
	interruptionCount: 0,
	localHour: 10,
};

const steadyContext: ScoringContext = {
	energy: "STEADY",
	completedWorkCycles: 0,
	interruptionCount: 0,
	localHour: 10,
};

function mkTask(
	overrides: Partial<ScoringTask> & Pick<ScoringTask, "id" | "workType">,
): ScoringTask {
	const urgency = overrides.urgency ?? overrides.weight ?? 2;
	return {
		weight: urgency,
		sortOrder: 0,
		createdAt: new Date("2026-01-01"),
		importance: 2,
		urgency,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		...overrides,
	};
}

describe("computeEisenhowerBase", () => {
	it("starts from urgency × importance", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 3,
			importance: 2,
		});
		expect(computeEisenhowerBase(task, steadyContext)).toBe(6);
	});

	it("applies Pareto boost when FOCUSED and importance >= 3", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 3,
		});
		expect(computeEisenhowerBase(task, baseContext)).toBeCloseTo(6 * 1.15);
	});

	it("applies Ockham low-effort boost when FADING and effort <= 30", () => {
		const fading: ScoringContext = { ...steadyContext, energy: "FADING" };
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: 20,
		});
		expect(computeEisenhowerBase(task, fading)).toBeCloseTo(4 * 1.12);
	});

	it("applies Ockham high-effort penalty when FADING and effort >= 90", () => {
		const fading: ScoringContext = { ...steadyContext, energy: "FADING" };
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: 120,
		});
		expect(computeEisenhowerBase(task, fading)).toBeCloseTo(4 * 0.88);
	});

	it("leaves base unchanged when effort is null", () => {
		const fading: ScoringContext = { ...steadyContext, energy: "FADING" };
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: null,
		});
		expect(computeEisenhowerBase(task, fading)).toBe(4);
	});

	it("boosts ASAP commitment horizon", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			commitmentHorizon: "ASAP",
		});
		expect(computeEisenhowerBase(task, steadyContext)).toBeCloseTo(4 * 1.18);
	});

	it("boosts THIS_WEEK commitment horizon", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			commitmentHorizon: "THIS_WEEK",
		});
		expect(computeEisenhowerBase(task, steadyContext)).toBeCloseTo(4 * 1.06);
	});
});

describe("scoreTask", () => {
	it("returns null for empty task list", () => {
		expect(pickBestTask([], baseContext)).toBeNull();
	});

	it("returns the only task when one candidate", () => {
		const task = mkTask({ id: 1, workType: "OPERATIONAL", urgency: 2 });
		expect(pickBestTask([task], baseContext)).toEqual(task);
	});

	it("prefers higher urgency × importance when session context is equal", () => {
		const higher = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 3,
			importance: 3,
			sortOrder: 1,
		});
		const lower = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			sortOrder: 0,
		});
		expect(pickBestTask([lower, higher], steadyContext)?.id).toBe(1);
	});

	it("prefers DEEP_WORK heavy when FOCUSED and fresh session", () => {
		const deep = mkTask({
			id: 1,
			workType: "DEEP_WORK",
			urgency: 3,
			sortOrder: 1,
		});
		const reactive = mkTask({
			id: 2,
			workType: "REACTIVE",
			urgency: 3,
			sortOrder: 0,
		});
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
		const deep = mkTask({
			id: 1,
			workType: "DEEP_WORK",
			urgency: 3,
			sortOrder: 0,
		});
		const reactive = mkTask({
			id: 2,
			workType: "REACTIVE",
			urgency: 2,
			sortOrder: 1,
		});
		expect(pickBestTask([deep, reactive], context)?.id).toBe(2);
	});

	it("prefers reactive work over deep work after interruptions", () => {
		const context: ScoringContext = {
			...baseContext,
			interruptionCount: 4,
		};
		const deep = mkTask({
			id: 1,
			workType: "DEEP_WORK",
			urgency: 2,
			sortOrder: 0,
		});
		const reactive = mkTask({
			id: 2,
			workType: "REACTIVE",
			urgency: 3,
			sortOrder: 1,
		});
		expect(pickBestTask([deep, reactive], context)?.id).toBe(2);
	});

	it("prefers lower sortOrder when scores tie", () => {
		const higherPriority = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			sortOrder: 0,
			createdAt: new Date("2026-01-02"),
		});
		const lowerPriority = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			urgency: 2,
			sortOrder: 1,
			createdAt: new Date("2026-01-01"),
		});
		expect(pickBestTask([lowerPriority, higherPriority], baseContext)?.id).toBe(
			1,
		);
	});

	it("tie-breaks on higher urgency then earlier createdAt when scores and sortOrder tie", () => {
		const higherUrgency = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 3,
			importance: 2,
			sortOrder: 0,
			createdAt: new Date("2026-01-02"),
		});
		const lowerUrgency = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 3,
			sortOrder: 0,
			createdAt: new Date("2026-01-01"),
		});
		expect(pickBestTask([lowerUrgency, higherUrgency], steadyContext)?.id).toBe(
			1,
		);
	});

	it("prefers ASAP over WHEN_POSSIBLE when Eisenhower products tie", () => {
		const asap = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			commitmentHorizon: "ASAP",
			sortOrder: 1,
		});
		const later = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			commitmentHorizon: "WHEN_POSSIBLE",
			sortOrder: 0,
		});
		expect(pickBestTask([later, asap], steadyContext)?.id).toBe(1);
	});

	it("prefers low-effort tasks when FADING", () => {
		const fading: ScoringContext = { ...steadyContext, energy: "FADING" };
		const quick = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: 20,
			sortOrder: 1,
		});
		const heavy = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: 120,
			sortOrder: 0,
		});
		expect(pickBestTask([heavy, quick], fading)?.id).toBe(1);
	});

	it("override boost can change winner when scores are close", () => {
		const operational = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			urgency: 2,
			sortOrder: 0,
		});
		const reactive = mkTask({
			id: 2,
			workType: "REACTIVE",
			urgency: 2,
			sortOrder: 1,
		});
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
