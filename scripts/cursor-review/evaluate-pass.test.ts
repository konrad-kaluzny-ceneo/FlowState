// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluatePass } from "./evaluate-pass.js";

describe("evaluatePass", () => {
	it("passes when all scores >= 6 and no critical findings", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 7, C3: 9, C4: 8, C6: 6 },
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(true);
		expect(result.failReasons).toEqual([]);
		expect(result.mean).toBeCloseTo(7.6);
	});

	it("fails when any score < 6", () => {
		const result = evaluatePass({
			scores: { C1: 5, C2: 8, C3: 7, C4: 8, C6: 7 },
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toContain("C1 below threshold (5/10)");
	});

	it("fails on critical findings", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8, C3: 8, C4: 8, C6: 8 },
			criticalCount: 1,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toContain("1 critical finding");
	});

	it("fails when zero scores parsed", () => {
		const result = evaluatePass({
			scores: {},
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toContain("missing scores: C1, C2, C3, C4, C6");
		expect(result.mean).toBeNull();
	});

	it("fails when only some applicable scores are present", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8 },
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toContain("missing scores: C3, C4, C6");
	});

	it("fails when C5 is missing and plan context is present", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8, C3: 8, C4: 8, C6: 8 },
			criticalCount: 0,
			hasPlanContext: true,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toContain("missing scores: C5");
	});

	it("does not require C5 when plan context is absent", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8, C3: 8, C4: 8, C6: 8 },
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(true);
		expect(result.failReasons).toEqual([]);
	});

	it("includes C5 in mean when plan context present", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8, C3: 8, C4: 8, C5: 8, C6: 8 },
			criticalCount: 0,
			hasPlanContext: true,
		});

		expect(result.passed).toBe(true);
		expect(result.mean).toBe(8);
	});

	it("excludes C5 from evaluation without plan context", () => {
		const result = evaluatePass({
			scores: { C1: 8, C2: 8, C3: 8, C4: 8, C5: 3, C6: 8 },
			criticalCount: 0,
			hasPlanContext: false,
		});

		expect(result.passed).toBe(true);
		expect(result.mean).toBe(8);
	});
});
