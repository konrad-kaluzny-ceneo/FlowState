import { describe, expect, it } from "vitest";
import { getTimerTickResult } from "./timer-worker-logic";

describe("getTimerTickResult", () => {
	describe("work mode", () => {
		it("returns tick with remaining when time is left", () => {
			const endTime = 10000;
			const now = 7000;
			const result = getTimerTickResult(endTime, now, "work");
			expect(result).toEqual({ type: "tick", remaining: 3000 });
		});

		it("returns complete when remaining is exactly 0", () => {
			const endTime = 10000;
			const now = 10000;
			const result = getTimerTickResult(endTime, now, "work");
			expect(result).toEqual({ type: "complete" });
		});

		it("returns complete when remaining is negative", () => {
			const endTime = 10000;
			const now = 12000;
			const result = getTimerTickResult(endTime, now, "work");
			expect(result).toEqual({ type: "complete" });
		});
	});

	describe("break mode", () => {
		it("returns tick with remaining when time is left", () => {
			const endTime = 10000;
			const now = 7000;
			const result = getTimerTickResult(endTime, now, "break");
			expect(result).toEqual({ type: "tick", remaining: 3000 });
		});

		it("returns overtime with elapsed when remaining is exactly 0", () => {
			const endTime = 10000;
			const now = 10000;
			const result = getTimerTickResult(endTime, now, "break");
			expect(result).toEqual({ type: "overtime", elapsed: 0 });
		});

		it("returns overtime with elapsed when past end time", () => {
			const endTime = 10000;
			const now = 15000;
			const result = getTimerTickResult(endTime, now, "break");
			expect(result).toEqual({ type: "overtime", elapsed: 5000 });
		});

		it("tracks increasing overtime elapsed", () => {
			const endTime = 10000;
			const result1 = getTimerTickResult(endTime, 11000, "break");
			const result2 = getTimerTickResult(endTime, 12000, "break");
			const result3 = getTimerTickResult(endTime, 13000, "break");

			expect(result1).toEqual({ type: "overtime", elapsed: 1000 });
			expect(result2).toEqual({ type: "overtime", elapsed: 2000 });
			expect(result3).toEqual({ type: "overtime", elapsed: 3000 });
		});
	});
});
