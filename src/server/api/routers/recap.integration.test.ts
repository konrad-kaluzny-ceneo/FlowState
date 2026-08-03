import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { recapRouter } = await import("~/server/api/routers/recap");

const createCaller = createCallerFactory(recapRouter);

const USER = "recap-integration-user";

function recapTestAnchor() {
	const now = new Date();
	const localDateKey = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");
	return { now, localDateKey };
}

/** Wide range covering "now" — mirrors what getLocalDayBoundary would produce
 * for a test anchored on `now`, without depending on wall-clock local time. */
function wideRangeAround(now: Date) {
	return {
		rangeStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
		rangeEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
	};
}

type CycleRow = {
	id: number;
	userId: string;
	taskId: number | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "COMPLETED" | "RUNNING" | "INTERRUPTED" | "PAUSED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	task: { id: number; title: string } | null;
};

type TaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
	isDailyStanding: boolean;
	effortMinutes: number | null;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date | null;
};

let cycles: CycleRow[] = [];
let tasks: TaskRow[] = [];
let completions: Array<{
	userId: string;
	taskId: number;
	localDateKey: string;
}> = [];

function createMockDb() {
	return {
		cycle: {
			findMany: vi.fn(
				(args: {
					where: {
						userId: string;
						kind?: string;
						state?: string | { in: string[] };
						taskId?: { in: number[] };
						startedAt?: { gte: Date; lt?: Date };
						OR?: Array<{
							startedAt?: { gte: Date; lt?: Date };
							endedAt?: { gte: Date; lt?: Date };
						}>;
					};
				}) => {
					let rows = cycles.filter((c) => c.userId === args.where.userId);
					if (args.where.kind != null) {
						rows = rows.filter((c) => c.kind === args.where.kind);
					}
					if (args.where.state != null) {
						if (typeof args.where.state === "string") {
							rows = rows.filter((c) => c.state === args.where.state);
						} else {
							const allowed = new Set(args.where.state.in);
							rows = rows.filter((c) => allowed.has(c.state));
						}
					}
					if (args.where.taskId?.in != null) {
						const allowed = new Set(args.where.taskId.in);
						rows = rows.filter(
							(c) => c.taskId != null && allowed.has(c.taskId),
						);
					}
					if (args.where.OR != null) {
						const startClause = args.where.OR[0]?.startedAt;
						const endClause = args.where.OR[1]?.endedAt;
						const gte = startClause?.gte;
						const lt = startClause?.lt;
						rows = rows.filter((c) => {
							const startedInRange =
								gte != null &&
								c.startedAt >= gte &&
								(lt == null || c.startedAt < lt);
							const endGte = endClause?.gte ?? gte;
							const endLt = endClause?.lt ?? lt;
							const endedInRange =
								c.endedAt != null &&
								endGte != null &&
								c.endedAt >= endGte &&
								(endLt == null || c.endedAt < endLt);
							return startedInRange || endedInRange;
						});
					} else if (args.where.startedAt != null) {
						const { gte, lt } = args.where.startedAt;
						rows = rows.filter(
							(c) => c.startedAt >= gte && (lt == null || c.startedAt < lt),
						);
					}
					return Promise.resolve(rows);
				},
			),
		},
		task: {
			findMany: vi.fn(
				(args: {
					where: {
						userId: string;
						status?: string | { not: string };
						updatedAt?: { gte: Date };
						OR?: Array<{ status: string } | { isDailyStanding: boolean }>;
					};
				}) => {
					let rows = tasks.filter((t) => t.userId === args.where.userId);
					const statusFilter = args.where.status;
					if (statusFilter != null) {
						if (typeof statusFilter === "string") {
							rows = rows.filter((t) => t.status === statusFilter);
						} else {
							rows = rows.filter((t) => t.status !== statusFilter.not);
						}
					}
					if (args.where.updatedAt?.gte != null) {
						const gte = args.where.updatedAt.gte;
						rows = rows.filter(
							(t) => t.updatedAt != null && t.updatedAt >= gte,
						);
					}
					if (args.where.OR != null) {
						rows = rows.filter(
							(t) => t.status === "active" || t.isDailyStanding,
						);
					}
					return Promise.resolve(rows);
				},
			),
			count: vi.fn(
				(args: {
					where: {
						userId: string;
						status?: { notIn: string[] };
					};
				}) => {
					let rows = tasks.filter((t) => t.userId === args.where.userId);
					if (args.where.status?.notIn != null) {
						const excluded = new Set(args.where.status.notIn);
						rows = rows.filter((t) => !excluded.has(t.status));
					}
					return Promise.resolve(rows.length);
				},
			),
		},
		taskDayCompletion: {
			findMany: vi.fn(
				(args: { where: { userId: string; localDateKey: string } }) => {
					return Promise.resolve(
						completions.filter(
							(c) =>
								c.userId === args.where.userId &&
								c.localDateKey === args.where.localDateKey,
						),
					);
				},
			),
		},
	};
}

function recapCaller(userId: string, db: ReturnType<typeof createMockDb>) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: `${userId}@example.com`,
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

describe("recap router integration", () => {
	beforeEach(() => {
		cycles = [];
		tasks = [];
		completions = [];
	});

	it("getDaily returns recap rows from seeded cycles via buildDailyRecap", async () => {
		const { now, localDateKey } = recapTestAnchor();

		tasks.push(
			{
				id: 1,
				userId: USER,
				title: "Write recap",
				status: "active",
				isDailyStanding: false,
				effortMinutes: 25,
				sortOrder: 0,
				createdAt: now,
				updatedAt: now,
			},
			{
				id: 2,
				userId: USER,
				title: "Review PR",
				status: "active",
				isDailyStanding: false,
				effortMinutes: 15,
				sortOrder: 1,
				createdAt: now,
				updatedAt: now,
			},
		);

		cycles.push(
			{
				id: 10,
				userId: USER,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
				endedAt: new Date(now.getTime() - 2.75 * 60 * 60 * 1000),
				task: { id: 1, title: "Write recap" },
			},
			{
				id: 11,
				userId: USER,
				taskId: 2,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
				endedAt: new Date(now.getTime() - (2 * 60 - 10) * 60 * 1000),
				task: { id: 2, title: "Review PR" },
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDaily({
			localDateKey,
		});

		expect(result.last24Hours).toHaveLength(2);
		expect(result.last24Hours.map((row) => row.title).sort()).toEqual([
			"Review PR",
			"Write recap",
		]);
		expect(result.todayPlan.map((row) => row.taskId)).toEqual([1, 2]);
		expect(result.footprints["1"]?.cumulativeMinutes).toBe(15);
		expect(result.footprints["2"]?.cumulativeMinutes).toBe(10);
	});

	it("getDayStats includes interrupted WORK in focusMinutes but not sessionCount", async () => {
		const { now } = recapTestAnchor();

		tasks.push({
			id: 1,
			userId: USER,
			title: "Deep task",
			status: "active",
			isDailyStanding: false,
			effortMinutes: 25,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});

		cycles.push(
			{
				id: 10,
				userId: USER,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
				endedAt: new Date(now.getTime() - 2.75 * 60 * 60 * 1000),
				task: { id: 1, title: "Deep task" },
			},
			{
				id: 11,
				userId: USER,
				taskId: 1,
				kind: "WORK",
				state: "INTERRUPTED",
				configuredDurationSec: 1500,
				startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
				endedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 10 * 60 * 1000),
				task: { id: 1, title: "Deep task" },
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDayStats(
			wideRangeAround(now),
		);

		// Completed (15 min) + interrupted (≈10 min) = 25
		expect(result.focusMinutes).toBe(25);
		// Only the completed cycle counts as a session
		expect(result.sessionCount).toBe(1);
		expect(result.avgSessionMinutes).toBe(15);
	});

	it("getDayStats reports breakMinutes from completed and interrupted breaks", async () => {
		const { now } = recapTestAnchor();

		tasks.push({
			id: 1,
			userId: USER,
			title: "Task",
			status: "active",
			isDailyStanding: false,
			effortMinutes: null,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});

		cycles.push(
			{
				id: 20,
				userId: USER,
				taskId: null,
				kind: "SHORT_BREAK",
				state: "COMPLETED",
				configuredDurationSec: 300,
				startedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
				endedAt: new Date(now.getTime() - 55 * 60 * 1000),
				task: null,
			},
			{
				id: 21,
				userId: USER,
				taskId: null,
				kind: "LONG_BREAK",
				state: "INTERRUPTED",
				configuredDurationSec: 900,
				startedAt: new Date(now.getTime() - 50 * 60 * 1000),
				endedAt: new Date(now.getTime() - 43 * 60 * 1000),
				task: null,
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDayStats(
			wideRangeAround(now),
		);

		// SHORT_BREAK completed: 5 min, LONG_BREAK interrupted: 7 min = 12
		expect(result.breakMinutes).toBe(12);
		// No WORK cycles → focus = 0, sessions = 0
		expect(result.focusMinutes).toBe(0);
		expect(result.sessionCount).toBe(0);
	});

	it("getDayStats paused-then-stopped cycle counts only pre-pause elapsed", async () => {
		const { now } = recapTestAnchor();

		tasks.push({
			id: 1,
			userId: USER,
			title: "Paused task",
			status: "active",
			isDailyStanding: false,
			effortMinutes: null,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});

		// Simulates: started 2h ago, ran for 5 min, paused, then interrupted
		// with endedAt = pausedAt (Phase 2 fix). So elapsed = 5 min.
		const startedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
		const pausedAndEndedAt = new Date(startedAt.getTime() + 5 * 60 * 1000);

		cycles.push({
			id: 30,
			userId: USER,
			taskId: 1,
			kind: "WORK",
			state: "INTERRUPTED",
			configuredDurationSec: 1500,
			startedAt,
			endedAt: pausedAndEndedAt,
			task: { id: 1, title: "Paused task" },
		});

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDayStats(
			wideRangeAround(now),
		);

		// Only 5 min of actual focus (not the paused span)
		expect(result.focusMinutes).toBe(5);
		expect(result.sessionCount).toBe(0);
	});

	it("getDayStats only includes cycles within the requested range", async () => {
		const { now } = recapTestAnchor();

		tasks.push({
			id: 1,
			userId: USER,
			title: "Task",
			status: "active",
			isDailyStanding: false,
			effortMinutes: null,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now,
		});

		// In range: 2h ago
		cycles.push({
			id: 40,
			userId: USER,
			taskId: 1,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 1500,
			startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
			endedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 20 * 60 * 1000),
			task: { id: 1, title: "Task" },
		});

		// Out of range: 3 days ago
		cycles.push({
			id: 41,
			userId: USER,
			taskId: 1,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 1500,
			startedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
			endedAt: new Date(
				now.getTime() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000,
			),
			task: { id: 1, title: "Task" },
		});

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDayStats(
			wideRangeAround(now),
		);

		// Only the in-range cycle (20 min) counts; the 3-day-old cycle is excluded
		expect(result.focusMinutes).toBe(20);
		expect(result.sessionCount).toBe(1);
	});

	it("getTrendStats returns windowDays points in chronological order, per-user isolated", async () => {
		const todayLocalMidnightUtc = new Date(2026, 6, 15);
		const otherUser = "recap-integration-user-2";

		tasks.push({
			id: 1,
			userId: USER,
			title: "Task",
			status: "active",
			isDailyStanding: false,
			effortMinutes: null,
			sortOrder: 0,
			createdAt: todayLocalMidnightUtc,
			updatedAt: todayLocalMidnightUtc,
		});

		cycles.push(
			{
				id: 50,
				userId: USER,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
				endedAt: new Date(2026, 6, 15, 10, 20, 0),
				task: { id: 1, title: "Task" },
			},
			{
				id: 51,
				userId: otherUser,
				taskId: null,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
				endedAt: new Date(2026, 6, 15, 10, 30, 0),
				task: null,
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getTrendStats({
			todayLocalMidnightUtc,
			todayLocalDateKey: "2026-07-15",
			windowDays: 7,
		});

		expect(result).toHaveLength(7);
		expect(result.map((p) => p.localDateKey)).toEqual([
			"2026-07-09",
			"2026-07-10",
			"2026-07-11",
			"2026-07-12",
			"2026-07-13",
			"2026-07-14",
			"2026-07-15",
		]);
		// Only USER's cycle counts, not otherUser's
		expect(result.at(-1)).toEqual({
			localDateKey: "2026-07-15",
			focusMinutes: 20,
			breakMinutes: 0,
			switchCount: 0,
		});
	});

	it("uses the client calendar key for trend labels", async () => {
		const db = createMockDb();
		const result = await recapCaller(USER, db).getTrendStats({
			todayLocalMidnightUtc: new Date("2026-07-15T04:00:00.000Z"),
			todayLocalDateKey: "2026-07-15",
			windowDays: 7,
		});

		expect(result.map((point) => point.localDateKey)).toEqual([
			"2026-07-09",
			"2026-07-10",
			"2026-07-11",
			"2026-07-12",
			"2026-07-13",
			"2026-07-14",
			"2026-07-15",
		]);
	});

	it("getTrendStats returns switchCount from alternating-task WORK cycles on the same day", async () => {
		const todayLocalMidnightUtc = new Date(2026, 6, 15);

		tasks.push(
			{
				id: 2,
				userId: USER,
				title: "Task A",
				status: "active",
				isDailyStanding: false,
				effortMinutes: null,
				sortOrder: 0,
				createdAt: todayLocalMidnightUtc,
				updatedAt: todayLocalMidnightUtc,
			},
			{
				id: 3,
				userId: USER,
				title: "Task B",
				status: "active",
				isDailyStanding: false,
				effortMinutes: null,
				sortOrder: 1,
				createdAt: todayLocalMidnightUtc,
				updatedAt: todayLocalMidnightUtc,
			},
		);

		cycles.push(
			{
				id: 70,
				userId: USER,
				taskId: 2,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(2026, 6, 15, 9, 0, 0),
				endedAt: new Date(2026, 6, 15, 9, 25, 0),
				task: { id: 2, title: "Task A" },
			},
			{
				id: 71,
				userId: USER,
				taskId: 3,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(2026, 6, 15, 10, 0, 0),
				endedAt: new Date(2026, 6, 15, 10, 25, 0),
				task: { id: 3, title: "Task B" },
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getTrendStats({
			todayLocalMidnightUtc,
			todayLocalDateKey: "2026-07-15",
			windowDays: 7,
		});

		expect(result.at(-1)?.switchCount).toBe(1);
	});

	it("getTrendStats excludes a cycle whose startedAt is before the window", async () => {
		const todayLocalMidnightUtc = new Date(2026, 6, 15);

		cycles.push({
			id: 60,
			userId: USER,
			taskId: null,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 1500,
			startedAt: new Date(2026, 6, 1, 10, 0, 0),
			endedAt: new Date(2026, 6, 1, 10, 20, 0),
			task: null,
		});

		const db = createMockDb();
		const result = await recapCaller(USER, db).getTrendStats({
			todayLocalMidnightUtc,
			todayLocalDateKey: "2026-07-15",
			windowDays: 7,
		});

		expect(result.every((p) => p.focusMinutes === 0)).toBe(true);
	});
});
