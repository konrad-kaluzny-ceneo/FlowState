import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTimerTickResult } from "./timer-worker-logic";

describe("timer worker logic", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns tick with remaining ms when before end time", () => {
		const now = Date.now();
		const endTime = now + 25_000;

		expect(getTimerTickResult(endTime, now)).toEqual({
			type: "tick",
			remaining: 25_000,
		});
	});

	it("returns complete when at or past end time", () => {
		const now = Date.now();
		const endTime = now;

		expect(getTimerTickResult(endTime, now)).toEqual({ type: "complete" });
		expect(getTimerTickResult(endTime - 1, now)).toEqual({ type: "complete" });
	});

	it("advances ticks until complete then stops on stop message", () => {
		const messages: Array<{ type: string; remaining?: number }> = [];
		let intervalId: ReturnType<typeof setInterval> | null = null;
		let endTime: number | null = null;

		const tick = () => {
			if (endTime == null) return;
			const result = getTimerTickResult(endTime, Date.now());
			messages.push(result);
			if (result.type === "complete" && intervalId != null) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};

		endTime = Date.now() + 2_500;
		tick();
		intervalId = setInterval(tick, 1000);

		vi.advanceTimersByTime(1_000);
		vi.advanceTimersByTime(1_000);
		vi.advanceTimersByTime(1_000);

		expect(messages.filter((m) => m.type === "tick").length).toBeGreaterThan(0);
		expect(messages.at(-1)).toEqual({ type: "complete" });

		const countAfterComplete = messages.length;
		if (intervalId != null) {
			clearInterval(intervalId);
		}
		intervalId = null;
		endTime = null;

		vi.advanceTimersByTime(5_000);
		expect(messages.length).toBe(countAfterComplete);
	});
});
