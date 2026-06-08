import { describe, expect, it } from "vitest";

import { formatEndedAgo } from "./format-ended-ago";

const NOW_MS = 1_700_000_000_000;

describe("formatEndedAgo", () => {
	it('returns "just now" for 0 seconds elapsed', () => {
		expect(formatEndedAgo(NOW_MS, NOW_MS)).toBe("just now");
	});

	it("returns seconds ago for under one minute", () => {
		expect(formatEndedAgo(NOW_MS - 59_000, NOW_MS)).toBe("59 seconds ago");
	});

	it("returns one minute ago at 60 seconds", () => {
		expect(formatEndedAgo(NOW_MS - 60_000, NOW_MS)).toBe("1 minute ago");
	});

	it("returns one hour ago at 3600 seconds", () => {
		expect(formatEndedAgo(NOW_MS - 3_600_000, NOW_MS)).toBe("1 hour ago");
	});
});
