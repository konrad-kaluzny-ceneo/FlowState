import { describe, expect, it } from "vitest";

import { getLocalDayBoundary } from "~/lib/time/local-day-boundary";

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
