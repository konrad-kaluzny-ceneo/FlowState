import { describe, expect, it } from "vitest";

import {
	findNearestOpenSlot,
	findOpenSlot,
	intervalsOverlap,
	wouldOverlap,
} from "./overlap";

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

describe("wouldOverlap", () => {
	const blocks = [
		{ id: 1, startMinute: 540, durationMinutes: 30 },
		{ id: 2, startMinute: 600, durationMinutes: 30 },
	];

	it("detects overlap against other blocks", () => {
		expect(
			wouldOverlap({ startMinute: 555, durationMinutes: 30 }, blocks),
		).toBe(true);
	});

	it("ignores the excluded block id", () => {
		expect(
			wouldOverlap({ startMinute: 540, durationMinutes: 30 }, blocks, 1),
		).toBe(false);
	});
});

describe("findNearestOpenSlot", () => {
	const blocks = [
		{ id: 1, startMinute: 540, durationMinutes: 30 },
		{ id: 2, startMinute: 570, durationMinutes: 30 },
	];

	it("returns preferred start when free", () => {
		expect(findNearestOpenSlot(blocks, 30, 480)).toBe(480);
	});

	it("finds the nearest free slot when preferred overlaps", () => {
		expect(findNearestOpenSlot(blocks, 30, 555, 99)).toBe(510);
	});

	it("returns null when duration cannot fit", () => {
		expect(findNearestOpenSlot([], 2000, 360)).toBeNull();
	});
});

describe("findOpenSlot", () => {
	it("starts from preferredStart when possible", () => {
		expect(findOpenSlot([], 30, 540)).toBe(540);
	});

	it("wraps earlier when afternoon is full", () => {
		const blocks = [{ id: 1, startMinute: 540, durationMinutes: 780 }];
		expect(findOpenSlot(blocks, 30, 540)).toBe(360);
	});

	it("does not scan before minStartMinute", () => {
		const blocks = [{ id: 1, startMinute: 540, durationMinutes: 780 }];
		expect(findOpenSlot(blocks, 30, 540, 540)).toBeNull();
	});
});
