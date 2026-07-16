import { describe, expect, it } from "vitest";

import { buildGuestDayStats } from "~/lib/guest/day-stats";
import type { GuestSnapshotV1 } from "~/lib/guest/schema";
import {
	aggregateDayStats,
	type CycleRow,
} from "~/lib/recap/aggregate-day-stats";

const NOW = new Date("2026-07-10T14:00:00Z");

function makeSnapshot(
	overrides: Partial<GuestSnapshotV1> = {},
): GuestSnapshotV1 {
	return {
		version: 1,
		tasks: [],
		sessions: [],
		cycles: [],
		...overrides,
	};
}

describe("buildGuestDayStats", () => {
	it("returns empty stats for empty snapshot", () => {
		const result = buildGuestDayStats(makeSnapshot(), NOW);
		expect(result.focusMinutes).toBe(0);
		expect(result.breakMinutes).toBe(0);
		expect(result.sessionCount).toBe(0);
	});

	it("counts completed and interrupted WORK cycles as focus", () => {
		const snapshot = makeSnapshot({
			tasks: [
				{
					id: "t1",
					title: "Task 1",
					status: "active",
					workType: "DEEP_WORK",
					weight: 2,
					importance: 2,
					urgency: 2,
					effortMinutes: null,
					commitmentHorizon: "WHEN_POSSIBLE",
					sortOrder: 0,
					resumeNote: null,
					project: null,
					personaPresetId: null,
					createdAt: new Date("2026-07-10T08:00:00Z"),
					updatedAt: null,
				},
			],
			cycles: [
				{
					id: "c1",
					sessionId: "s1",
					taskId: "t1",
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date("2026-07-10T10:00:00Z"),
					endedAt: new Date("2026-07-10T10:25:00Z"),
					pausedAt: null,
				},
				{
					id: "c2",
					sessionId: "s1",
					taskId: "t1",
					kind: "WORK",
					state: "INTERRUPTED",
					configuredDurationSec: 1500,
					startedAt: new Date("2026-07-10T11:00:00Z"),
					endedAt: new Date("2026-07-10T11:10:00Z"),
					pausedAt: null,
				},
			],
		});

		const result = buildGuestDayStats(snapshot, NOW);
		expect(result.focusMinutes).toBe(35); // 25 + 10
		expect(result.sessionCount).toBe(1); // Only COMPLETED
		expect(result.avgSessionMinutes).toBe(25);
	});

	it("counts break cycles in breakMinutes", () => {
		const snapshot = makeSnapshot({
			cycles: [
				{
					id: "c3",
					sessionId: "s1",
					taskId: null,
					kind: "SHORT_BREAK",
					state: "COMPLETED",
					configuredDurationSec: 300,
					startedAt: new Date("2026-07-10T12:00:00Z"),
					endedAt: new Date("2026-07-10T12:05:00Z"),
					pausedAt: null,
				},
				{
					id: "c4",
					sessionId: "s1",
					taskId: null,
					kind: "LONG_BREAK",
					state: "INTERRUPTED",
					configuredDurationSec: 900,
					startedAt: new Date("2026-07-10T13:00:00Z"),
					endedAt: new Date("2026-07-10T13:07:00Z"),
					pausedAt: null,
				},
			],
		});

		const result = buildGuestDayStats(snapshot, NOW);
		expect(result.breakMinutes).toBe(12); // 5 + 7
		expect(result.focusMinutes).toBe(0);
	});

	it("excludes cycles outside the 24h window", () => {
		const snapshot = makeSnapshot({
			cycles: [
				{
					id: "c5",
					sessionId: "s1",
					taskId: null,
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date("2026-07-09T10:00:00Z"),
					endedAt: new Date("2026-07-09T10:25:00Z"),
					pausedAt: null,
				},
			],
		});

		const result = buildGuestDayStats(snapshot, NOW);
		expect(result.focusMinutes).toBe(0);
	});

	it("produces same totals as aggregateDayStats for equivalent fixture", () => {
		const snapshot = makeSnapshot({
			tasks: [
				{
					id: "t1",
					title: "Task 1",
					status: "active",
					workType: "DEEP_WORK",
					weight: 2,
					importance: 2,
					urgency: 2,
					effortMinutes: null,
					commitmentHorizon: "WHEN_POSSIBLE",
					sortOrder: 0,
					resumeNote: null,
					project: null,
					personaPresetId: null,
					createdAt: new Date("2026-07-10T08:00:00Z"),
					updatedAt: null,
				},
			],
			cycles: [
				{
					id: "c1",
					sessionId: "s1",
					taskId: "t1",
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date("2026-07-10T10:00:00Z"),
					endedAt: new Date("2026-07-10T10:20:00Z"),
					pausedAt: null,
				},
				{
					id: "c2",
					sessionId: "s1",
					taskId: "t1",
					kind: "WORK",
					state: "INTERRUPTED",
					configuredDurationSec: 1500,
					startedAt: new Date("2026-07-10T11:00:00Z"),
					endedAt: new Date("2026-07-10T11:05:00Z"),
					pausedAt: null,
				},
				{
					id: "c3",
					sessionId: "s1",
					taskId: null,
					kind: "SHORT_BREAK",
					state: "COMPLETED",
					configuredDurationSec: 300,
					startedAt: new Date("2026-07-10T12:00:00Z"),
					endedAt: new Date("2026-07-10T12:05:00Z"),
					pausedAt: null,
				},
			],
		});

		const guestResult = buildGuestDayStats(snapshot, NOW);

		// Build equivalent CycleRow[] for aggregateDayStats
		const authCycles: CycleRow[] = [
			{
				id: 1,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-07-10T10:00:00Z"),
				endedAt: new Date("2026-07-10T10:20:00Z"),
				task: { id: 1, status: "active", workType: "DEEP_WORK" },
			},
			{
				id: 2,
				taskId: 1,
				kind: "WORK",
				state: "INTERRUPTED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-07-10T11:00:00Z"),
				endedAt: new Date("2026-07-10T11:05:00Z"),
				task: { id: 1, status: "active", workType: "DEEP_WORK" },
			},
			{
				id: 3,
				taskId: null,
				kind: "SHORT_BREAK",
				state: "COMPLETED",
				configuredDurationSec: 300,
				startedAt: new Date("2026-07-10T12:00:00Z"),
				endedAt: new Date("2026-07-10T12:05:00Z"),
				task: null,
			},
		];

		const authResult = aggregateDayStats(authCycles, 1);

		// Parity: same focus, break, and session counts
		expect(guestResult.focusMinutes).toBe(authResult.focusMinutes);
		expect(guestResult.breakMinutes).toBe(authResult.breakMinutes);
		expect(guestResult.sessionCount).toBe(authResult.sessionCount);
		expect(guestResult.avgSessionMinutes).toBe(authResult.avgSessionMinutes);
	});
});
