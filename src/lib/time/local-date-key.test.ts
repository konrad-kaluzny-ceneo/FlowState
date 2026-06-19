import { describe, expect, it } from "vitest";

import { formatLocalDateKey } from "./local-date-key";

describe("formatLocalDateKey", () => {
	it("formats a date as YYYY-MM-DD in local timezone", () => {
		const date = new Date(2026, 5, 19, 15, 30);
		expect(formatLocalDateKey(date)).toBe("2026-06-19");
	});

	it("pads month and day at month boundary", () => {
		const lastDayOfMonth = new Date(2026, 0, 31, 23, 59);
		expect(formatLocalDateKey(lastDayOfMonth)).toBe("2026-01-31");

		const firstDayNextMonth = new Date(2026, 1, 1, 0, 1);
		expect(formatLocalDateKey(firstDayNextMonth)).toBe("2026-02-01");
	});
});
