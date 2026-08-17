import { describe, expect, it } from "vitest";

import { intervalsOverlap } from "./overlap";

describe("intervalsOverlap", () => {
	it("allows adjacent blocks that only touch at the boundary", () => {
		expect(
			intervalsOverlap(
				{ startMinute: 540, durationMinutes: 30 },
				{ startMinute: 570, durationMinutes: 30 },
			),
		).toBe(false);
	});

	it("rejects partial overlap", () => {
		expect(
			intervalsOverlap(
				{ startMinute: 540, durationMinutes: 45 },
				{ startMinute: 570, durationMinutes: 30 },
			),
		).toBe(true);
	});

	it("rejects when one block is fully contained in another", () => {
		expect(
			intervalsOverlap(
				{ startMinute: 540, durationMinutes: 120 },
				{ startMinute: 570, durationMinutes: 30 },
			),
		).toBe(true);
	});

	it("rejects identical intervals", () => {
		expect(
			intervalsOverlap(
				{ startMinute: 600, durationMinutes: 30 },
				{ startMinute: 600, durationMinutes: 30 },
			),
		).toBe(true);
	});
});
