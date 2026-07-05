import { describe, expect, it } from "vitest";
import { buildGuestDailyRecap } from "~/lib/guest/recap";
import { createEmptyGuestSnapshot } from "~/lib/guest/schema";

const TASK_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-06-20T12:00:00Z");
const DATE_KEY = "2026-06-20";

describe("buildGuestDailyRecap", () => {
	it("rolls up guest cycle minutes into last 24h recap", () => {
		const snapshot = createEmptyGuestSnapshot();
		snapshot.tasks.push({
			id: TASK_A,
			title: "Guest task",
			status: "active",
			workType: "OPERATIONAL",
			weight: 2,
			importance: 2,
			urgency: 2,
			effortMinutes: 25,
			commitmentHorizon: "WHEN_POSSIBLE",
			sortOrder: 0,
			resumeNote: null,
			project: null,
			personaPresetId: null,
			isDailyStanding: false,
			createdAt: NOW,
			updatedAt: NOW,
		});
		snapshot.cycles.push({
			id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
			sessionId: SESSION,
			taskId: TASK_A,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 1500,
			startedAt: new Date("2026-06-20T10:00:00Z"),
			endedAt: new Date("2026-06-20T10:25:00Z"),
		});

		const recap = buildGuestDailyRecap(snapshot, DATE_KEY, new Set(), NOW);

		expect(recap.last24Hours).toHaveLength(1);
		expect(recap.last24Hours[0]).toMatchObject({
			taskId: TASK_A,
			focusedMinutes: 25,
		});
		expect(recap.footprints[TASK_A]?.cumulativeMinutes).toBe(25);
	});

	it("excludes standing tasks done for today from today plan", () => {
		const snapshot = createEmptyGuestSnapshot();
		snapshot.tasks.push(
			{
				id: TASK_A,
				title: "Active",
				status: "active",
				workType: "OPERATIONAL",
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: null,
				commitmentHorizon: "WHEN_POSSIBLE",
				sortOrder: 0,
				resumeNote: null,
				project: null,
				personaPresetId: null,
				isDailyStanding: false,
				createdAt: NOW,
				updatedAt: NOW,
			},
			{
				id: TASK_B,
				title: "Standing",
				status: "completed",
				workType: "OPERATIONAL",
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: 15,
				commitmentHorizon: "WHEN_POSSIBLE",
				sortOrder: 1,
				resumeNote: null,
				project: null,
				personaPresetId: null,
				isDailyStanding: true,
				createdAt: NOW,
				updatedAt: NOW,
			},
		);

		const recap = buildGuestDailyRecap(
			snapshot,
			DATE_KEY,
			new Set([TASK_B]),
			NOW,
		);

		expect(recap.todayPlan.map((row) => row.taskId)).toEqual([TASK_A]);
	});

	it("excludes planned tasks from today plan", () => {
		const snapshot = createEmptyGuestSnapshot();
		snapshot.tasks.push(
			{
				id: TASK_A,
				title: "Backlog",
				status: "planned",
				workType: "OPERATIONAL",
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: null,
				commitmentHorizon: "WHEN_POSSIBLE",
				sortOrder: 0,
				resumeNote: null,
				project: null,
				personaPresetId: null,
				isDailyStanding: false,
				createdAt: NOW,
				updatedAt: NOW,
			},
			{
				id: TASK_B,
				title: "Ready",
				status: "active",
				workType: "OPERATIONAL",
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: null,
				commitmentHorizon: "WHEN_POSSIBLE",
				sortOrder: 1,
				resumeNote: null,
				project: null,
				personaPresetId: null,
				isDailyStanding: false,
				createdAt: NOW,
				updatedAt: NOW,
			},
		);

		const recap = buildGuestDailyRecap(snapshot, DATE_KEY, new Set(), NOW);

		expect(recap.todayPlan.map((row) => row.taskId)).toEqual([TASK_B]);
	});
});
