import { describe, expect, it } from "vitest";

import {
	getLocalDayBoundaries,
	getLocalDayBoundary,
} from "~/lib/time/local-day-boundary";

describe("getLocalDayBoundary", () => {
	it("computes local midnight to next local midnight", () => {
		const date = new Date(2026, 6, 15, 14, 30, 0); // 2026-07-15 14:30 local
		const { start, end, localDateKey } = getLocalDayBoundary(date);

		expect(localDateKey).toBe("2026-07-15");
		expect(start.getFullYear()).toBe(2026);
		expect(start.getMonth()).toBe(6);
		expect(start.getDate()).toBe(15);
		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);
		expect(start.getSeconds()).toBe(0);

		expect(end.getFullYear()).toBe(2026);
		expect(end.getMonth()).toBe(6);
		expect(end.getDate()).toBe(16);
		expect(end.getHours()).toBe(0);
	});

	it("rolls over correctly at a month boundary", () => {
		const date = new Date(2026, 6, 31, 23, 59, 59);
		const { start, end, localDateKey } = getLocalDayBoundary(date);

		expect(localDateKey).toBe("2026-07-31");
		expect(start.getMonth()).toBe(6);
		expect(start.getDate()).toBe(31);
		expect(end.getMonth()).toBe(7);
		expect(end.getDate()).toBe(1);
	});

	it("defaults to now when no date is supplied", () => {
		const before = new Date();
		const { start } = getLocalDayBoundary();
		expect(start.getDate()).toBe(before.getDate());
	});

	it("produces a start strictly before end", () => {
		const { start, end } = getLocalDayBoundary(new Date(2026, 0, 1));
		expect(start.getTime()).toBeLessThan(end.getTime());
	});
});

describe("getLocalDayBoundaries", () => {
	it("returns windowDays boundaries in chronological order, today last", () => {
		const reference = new Date(2026, 6, 15, 10, 0, 0);
		const boundaries = getLocalDayBoundaries(7, reference);

		expect(boundaries).toHaveLength(7);
		expect(boundaries[0]?.localDateKey).toBe("2026-07-09");
		expect(boundaries[6]?.localDateKey).toBe("2026-07-15");

		for (let i = 1; i < boundaries.length; i++) {
			const prevEnd = boundaries[i - 1]?.end.getTime();
			const curStart = boundaries[i]?.start.getTime();
			expect(curStart).toBe(prevEnd);
		}
	});

	it("supports a 30-day window", () => {
		const reference = new Date(2026, 6, 15);
		const boundaries = getLocalDayBoundaries(30, reference);

		expect(boundaries).toHaveLength(30);
		expect(boundaries[0]?.localDateKey).toBe("2026-06-16");
		expect(boundaries[29]?.localDateKey).toBe("2026-07-15");
	});

	it("rolls over correctly across a month boundary", () => {
		const reference = new Date(2026, 6, 2);
		const boundaries = getLocalDayBoundaries(3, reference);

		expect(boundaries.map((b) => b.localDateKey)).toEqual([
			"2026-06-30",
			"2026-07-01",
			"2026-07-02",
		]);
	});
});
