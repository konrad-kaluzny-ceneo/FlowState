import { describe, expect, it } from "vitest";

import {
	type DelegationCandidateTask,
	pickDelegationCandidate,
	scoreDelegationCandidate,
} from "./delegation-score";

function mkTask(
	overrides: Partial<DelegationCandidateTask> &
		Pick<DelegationCandidateTask, "id" | "workType">,
): DelegationCandidateTask {
	return {
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		importance: 2,
		urgency: 2,
		sortOrder: 0,
		createdAt: new Date("2026-01-01"),
		...overrides,
	};
}

describe("scoreDelegationCandidate", () => {
	it("starts from a base score of 1 divided by importance × urgency", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			importance: 2,
			urgency: 2,
			commitmentHorizon: "ASAP",
		});
		expect(scoreDelegationCandidate(task)).toBeCloseTo(1 / 4);
	});

	it("applies a low-effort boost when effortMinutes <= 30", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			effortMinutes: 20,
			commitmentHorizon: "ASAP",
			importance: 2,
			urgency: 2,
		});
		expect(scoreDelegationCandidate(task)).toBeCloseTo((1 * 1.2) / 4);
	});

	it("does not apply the low-effort boost when effortMinutes > 30", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			effortMinutes: 45,
			commitmentHorizon: "ASAP",
			importance: 2,
			urgency: 2,
		});
		expect(scoreDelegationCandidate(task)).toBeCloseTo(1 / 4);
	});

	it("applies a WHEN_POSSIBLE boost", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			commitmentHorizon: "WHEN_POSSIBLE",
			importance: 2,
			urgency: 2,
		});
		expect(scoreDelegationCandidate(task)).toBeCloseTo((1 * 1.15) / 4);
	});

	it("combines the low-effort and WHEN_POSSIBLE boosts", () => {
		const task = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
			importance: 1,
			urgency: 1,
		});
		expect(scoreDelegationCandidate(task)).toBeCloseTo(1 * 1.2 * 1.15);
	});

	it("favors low-priority (low importance × urgency) tasks", () => {
		const lowPriority = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			importance: 1,
			urgency: 1,
		});
		const highPriority = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			importance: 3,
			urgency: 3,
		});
		expect(scoreDelegationCandidate(lowPriority)).toBeGreaterThan(
			scoreDelegationCandidate(highPriority),
		);
	});
});

describe("pickDelegationCandidate", () => {
	it("returns null for an empty pool", () => {
		expect(pickDelegationCandidate([])).toBeNull();
	});

	it("returns the only candidate when the pool has one non-DEEP_WORK task", () => {
		const task = mkTask({ id: 1, workType: "OPERATIONAL" });
		expect(pickDelegationCandidate([task])).toEqual(task);
	});

	it("returns null when every task in the pool is DEEP_WORK", () => {
		const tasks = [
			mkTask({ id: 1, workType: "DEEP_WORK" }),
			mkTask({ id: 2, workType: "DEEP_WORK" }),
		];
		expect(pickDelegationCandidate(tasks)).toBeNull();
	});

	it("favors low effort and WHEN_POSSIBLE over a higher-effort, ASAP task", () => {
		const lowEffort = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
		});
		const highEffort = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			effortMinutes: 120,
			commitmentHorizon: "ASAP",
		});
		expect(pickDelegationCandidate([highEffort, lowEffort])?.id).toBe(1);
	});

	it("prefers lower sortOrder when scores tie", () => {
		const later = mkTask({ id: 1, workType: "OPERATIONAL", sortOrder: 1 });
		const earlier = mkTask({ id: 2, workType: "OPERATIONAL", sortOrder: 0 });
		expect(pickDelegationCandidate([later, earlier])?.id).toBe(2);
	});

	it("tie-breaks on higher urgency then higher importance then earlier createdAt when scores and sortOrder tie", () => {
		const lowerUrgency = mkTask({
			id: 1,
			workType: "OPERATIONAL",
			sortOrder: 0,
			urgency: 1,
			importance: 1,
			createdAt: new Date("2026-01-02"),
		});
		const higherUrgency = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			sortOrder: 0,
			urgency: 1,
			importance: 1,
			createdAt: new Date("2026-01-01"),
		});
		// Scores are equal (same effort/horizon/importance*urgency), sortOrder
		// ties, so this falls through to the createdAt tie-break — mirrors
		// pickBestTask's convention exactly.
		expect(pickDelegationCandidate([lowerUrgency, higherUrgency])?.id).toBe(2);
	});

	it("never returns a DEEP_WORK task even when it has the lowest importance × urgency in the pool", () => {
		// Regression test for the hard-exclusion fix: a naive soft multiplier
		// would let this low-priority DEEP_WORK task out-score the higher
		// priority but genuinely delegatable OPERATIONAL/low-effort task,
		// since the ÷(importance × urgency) term dominates the bonus swing.
		const lowPriorityDeepWork = mkTask({
			id: 1,
			workType: "DEEP_WORK",
			importance: 1,
			urgency: 1,
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
		});
		const higherPriorityDelegatable = mkTask({
			id: 2,
			workType: "OPERATIONAL",
			importance: 2,
			urgency: 2,
			effortMinutes: 20,
			commitmentHorizon: "WHEN_POSSIBLE",
		});

		const winner = pickDelegationCandidate([
			lowPriorityDeepWork,
			higherPriorityDelegatable,
		]);

		expect(winner?.id).toBe(2);
		expect(winner?.workType).not.toBe("DEEP_WORK");
	});

	it("excludes a DEEP_WORK task from a larger mixed pool", () => {
		const deepWork = mkTask({
			id: 1,
			workType: "DEEP_WORK",
			importance: 1,
			urgency: 1,
		});
		const reactive = mkTask({
			id: 2,
			workType: "REACTIVE",
			importance: 3,
			urgency: 3,
			effortMinutes: 90,
			commitmentHorizon: "ASAP",
		});
		const operationalLowEffort = mkTask({
			id: 3,
			workType: "OPERATIONAL",
			importance: 2,
			urgency: 2,
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
		});

		const winner = pickDelegationCandidate([
			deepWork,
			reactive,
			operationalLowEffort,
		]);

		expect(winner?.id).toBe(3);
	});
});
