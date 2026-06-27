import { describe, expect, it } from "vitest";
import { taskPoolHasKickoffCandidates } from "~/hooks/use-pomodoro-cycle";
import {
	getStaleArchiveCutoff,
	getTaskTouchAnchor,
	matchesStaleArchivePredicate,
	STALE_TASK_ARCHIVE_DAYS,
} from "~/lib/task/stale-task-archive";

describe("stale task archive predicate", () => {
	const now = new Date("2026-06-27T12:00:00.000Z");
	const cutoff = getStaleArchiveCutoff(now);

	it("uses updatedAt when present", () => {
		const anchor = getTaskTouchAnchor({
			updatedAt: new Date("2026-06-20T12:00:00.000Z"),
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		});
		expect(anchor.toISOString()).toBe("2026-06-20T12:00:00.000Z");
	});

	it("falls back to createdAt when updatedAt is null", () => {
		const anchor = getTaskTouchAnchor({
			updatedAt: null,
			createdAt: new Date("2026-06-01T00:00:00.000Z"),
		});
		expect(anchor.toISOString()).toBe("2026-06-01T00:00:00.000Z");
	});

	it("archives active non-standing tasks at or before the three-day cutoff", () => {
		expect(
			matchesStaleArchivePredicate(
				{
					status: "active",
					isDailyStanding: false,
					updatedAt: cutoff,
					createdAt: new Date("2026-01-01"),
				},
				cutoff,
			),
		).toBe(true);
	});

	it("does not archive active tasks newer than the cutoff", () => {
		const justAfterCutoff = new Date(cutoff.getTime() + 1);
		expect(
			matchesStaleArchivePredicate(
				{
					status: "active",
					isDailyStanding: false,
					updatedAt: justAfterCutoff,
					createdAt: new Date("2026-01-01"),
				},
				cutoff,
			),
		).toBe(false);
	});

	it("exempts daily-standing tasks", () => {
		expect(
			matchesStaleArchivePredicate(
				{
					status: "active",
					isDailyStanding: true,
					updatedAt: new Date("2020-01-01"),
					createdAt: new Date("2020-01-01"),
				},
				cutoff,
			),
		).toBe(false);
	});

	it("does not mutate completed or already archived tasks", () => {
		const stale = {
			isDailyStanding: false,
			updatedAt: new Date("2020-01-01"),
			createdAt: new Date("2020-01-01"),
		};
		expect(
			matchesStaleArchivePredicate({ ...stale, status: "completed" }, cutoff),
		).toBe(false);
		expect(
			matchesStaleArchivePredicate({ ...stale, status: "archived" }, cutoff),
		).toBe(false);
	});

	it(`uses a ${STALE_TASK_ARCHIVE_DAYS}-day window`, () => {
		const boundary = new Date(now);
		boundary.setDate(boundary.getDate() - STALE_TASK_ARCHIVE_DAYS);
		expect(cutoff.toISOString()).toBe(boundary.toISOString());
	});
});

describe("taskPoolHasKickoffCandidates", () => {
	it("returns false when only archived tasks remain", () => {
		expect(
			taskPoolHasKickoffCandidates([
				{ status: "archived", isDailyStanding: false },
				{ status: "archived", isDailyStanding: true },
			]),
		).toBe(false);
	});

	it("returns true for active tasks and eligible standing tasks", () => {
		expect(
			taskPoolHasKickoffCandidates([
				{ status: "active", isDailyStanding: false },
			]),
		).toBe(true);
		expect(
			taskPoolHasKickoffCandidates([
				{ status: "completed", isDailyStanding: true },
			]),
		).toBe(true);
	});

	it("ignores standing tasks marked done for today", () => {
		expect(
			taskPoolHasKickoffCandidates([
				{
					status: "active",
					isDailyStanding: true,
					doneForToday: true,
				},
			]),
		).toBe(false);
	});
});
