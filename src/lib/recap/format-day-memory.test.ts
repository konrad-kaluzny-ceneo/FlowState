import { describe, expect, it } from "vitest";

import type { DailyRecap } from "~/lib/recap/types";

import { formatDayMemory } from "./format-day-memory";

function buildRecap(overrides: Partial<DailyRecap> = {}): DailyRecap {
	return {
		last24Hours: [],
		todayPlan: [],
		footprints: {},
		...overrides,
	};
}

describe("formatDayMemory — sections", () => {
	it("maps done items from recap.last24Hours", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Write tests",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.sections.done.items).toEqual([
			{ taskId: "t1", title: "Write tests" },
		]);
	});

	it("maps remains items only from todayPlan rows not done for today", () => {
		const recap = buildRecap({
			todayPlan: [
				{
					taskId: "t2",
					title: "API review",
					isDailyStanding: false,
					doneForToday: false,
					effortMinutes: 30,
				},
				{
					taskId: "t3",
					title: "Already closed",
					isDailyStanding: false,
					doneForToday: true,
					effortMinutes: 15,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.sections.remains.items).toEqual([
			{ taskId: "t2", title: "API review" },
		]);
	});

	it("resolves returnTo with resume note when continueTaskId matches an active task with a note", () => {
		const recap = buildRecap();

		const result = formatDayMemory({
			recap,
			tasks: [
				{
					id: "t9",
					status: "active",
					title: "API review",
					resumeNote: "Check the pagination edge case",
				},
			],
			continueTaskId: "t9",
			locale: "en",
		});

		expect(result.sections.returnTo.value).toEqual({
			taskTitle: "API review",
			resumeNote: "Check the pagination edge case",
		});
	});

	it("resolves returnTo without a resume note when the active task has none", () => {
		const recap = buildRecap();

		const result = formatDayMemory({
			recap,
			tasks: [{ id: "t9", status: "active", title: "API review" }],
			continueTaskId: "t9",
			locale: "en",
		});

		expect(result.sections.returnTo.value).toEqual({
			taskTitle: "API review",
			resumeNote: null,
		});
	});

	it("returns null returnTo when continueTaskId is null", () => {
		const recap = buildRecap();

		const result = formatDayMemory({
			recap,
			tasks: [{ id: "t9", status: "active", title: "API review" }],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.sections.returnTo.value).toBeNull();
	});

	it("returns null returnTo when no active tasks exist to resolve a title", () => {
		const recap = buildRecap();

		const result = formatDayMemory({
			recap,
			tasks: [{ id: "t9", status: "completed", title: "API review" }],
			continueTaskId: "t9",
			locale: "en",
		});

		expect(result.sections.returnTo.value).toBeNull();
	});
});

describe("formatDayMemory — hasContent boundary", () => {
	it("is false when done, remains, and returnTo are all empty/null", () => {
		const result = formatDayMemory({
			recap: buildRecap(),
			tasks: [],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.hasContent).toBe(false);
	});

	it("is true when only done has content", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Write tests",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.hasContent).toBe(true);
	});

	it("is true when only returnTo resolves", () => {
		const result = formatDayMemory({
			recap: buildRecap(),
			tasks: [{ id: "t9", status: "active", title: "API review" }],
			continueTaskId: "t9",
			locale: "en",
		});

		expect(result.hasContent).toBe(true);
	});
});

describe("formatDayMemory — collapsed line composition", () => {
	it("builds the EN collapsed line within the one-line budget", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Write tests",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
				{
					taskId: "t2",
					title: "Ship feature",
					firstStartedAt: new Date("2026-07-02T09:00:00Z"),
					lastEndedAt: new Date("2026-07-02T10:00:00Z"),
					focusedMinutes: 30,
				},
			],
			todayPlan: [
				{
					taskId: "t3",
					title: "Follow up",
					isDailyStanding: false,
					doneForToday: false,
					effortMinutes: null,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [
				{
					id: "t9",
					status: "active",
					title: "API review",
				},
			],
			continueTaskId: "t9",
			locale: "en",
		});

		expect(result.collapsedLine).toBe(
			"Done: 2 tasks. Remains: 1 open. Return calmly to: API review.",
		);
		expect(result.collapsedLine.length).toBeLessThanOrEqual(120);
	});

	it("builds the PL collapsed line from the batch-7 template", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Napisz testy",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
			],
			todayPlan: [
				{
					taskId: "t3",
					title: "Follow up",
					isDailyStanding: false,
					doneForToday: false,
					effortMinutes: null,
				},
				{
					taskId: "t4",
					title: "Review PR",
					isDailyStanding: false,
					doneForToday: false,
					effortMinutes: null,
				},
				{
					taskId: "t5",
					title: "Plan sprint",
					isDailyStanding: false,
					doneForToday: false,
					effortMinutes: null,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [{ id: "t9", status: "active", title: "Przegląd API" }],
			continueTaskId: "t9",
			locale: "pl",
		});

		expect(result.collapsedLine).toBe(
			"Zrobione: 1 zadanie. Zostało: 3 otwarte. Wróć spokojnie do: Przegląd API.",
		);
	});

	it("omits the return-to clause entirely when there is no next task", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Write tests",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "en",
		});

		expect(result.collapsedLine).toBe("Done: 1 task. Remains: 0 open.");
	});

	it("omits the return-to clause entirely when there is no next task (PL)", () => {
		const recap = buildRecap({
			last24Hours: [
				{
					taskId: "t1",
					title: "Napisz testy",
					firstStartedAt: new Date("2026-07-02T08:00:00Z"),
					lastEndedAt: new Date("2026-07-02T09:00:00Z"),
					focusedMinutes: 45,
				},
			],
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "pl",
		});

		expect(result.collapsedLine).toBe(
			"Zrobione: 1 zadanie. Zostało: 0 otwartych.",
		);
	});
});

describe("formatDayMemory — PL plural boundaries (1 / 2 / 5)", () => {
	it.each([
		[1, "1 zadanie"],
		[2, "2 zadania"],
		[5, "5 zadań"],
	])("renders doneCount=%i as %s inside the PL collapsed line", (count, expected) => {
		const recap = buildRecap({
			last24Hours: Array.from({ length: count }, (_, index) => ({
				taskId: `t${index}`,
				title: `Task ${index}`,
				firstStartedAt: new Date("2026-07-02T08:00:00Z"),
				lastEndedAt: new Date("2026-07-02T09:00:00Z"),
				focusedMinutes: 10,
			})),
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "pl",
		});

		expect(result.collapsedLine).toContain(expected);
	});

	it.each([
		[1, "1 otwarte"],
		[2, "2 otwarte"],
		[5, "5 otwartych"],
	])("renders remainingCount=%i as %s inside the PL collapsed line", (count, expected) => {
		const recap = buildRecap({
			todayPlan: Array.from({ length: count }, (_, index) => ({
				taskId: `r${index}`,
				title: `Remaining ${index}`,
				isDailyStanding: false,
				doneForToday: false,
				effortMinutes: null,
			})),
		});

		const result = formatDayMemory({
			recap,
			tasks: [],
			continueTaskId: null,
			locale: "pl",
		});

		expect(result.collapsedLine).toContain(expected);
	});
});
