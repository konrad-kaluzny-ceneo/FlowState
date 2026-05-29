import { describe, expect, it } from "vitest";

import { formatRemainingMs } from "./format-remaining";

describe("formatRemainingMs", () => {
	it("formats minutes and seconds with zero padding", () => {
		expect(formatRemainingMs(90_000)).toBe("01:30");
		expect(formatRemainingMs(0)).toBe("00:00");
		expect(formatRemainingMs(3_500)).toBe("00:04");
	});
});
