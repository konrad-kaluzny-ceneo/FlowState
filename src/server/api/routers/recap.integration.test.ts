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
						OR?: Array<{
							startedAt?: { gte: Date };
							endedAt?: { gte: Date };
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
						const windowStart = args.where.OR[0]?.startedAt?.gte;
						if (windowStart != null) {
							rows = rows.filter(
								(c) =>
									c.startedAt >= windowStart ||
									(c.endedAt != null && c.endedAt >= windowStart),
							);
						}
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
		const { now, localDateKey } = recapTestAnchor();

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
		const result = await recapCaller(USER, db).getDayStats({ localDateKey });

		// Completed (15 min) + interrupted (≈10 min) = 25
		expect(result.focusMinutes).toBe(25);
		// Only the completed cycle counts as a session
		expect(result.sessionCount).toBe(1);
		expect(result.avgSessionMinutes).toBe(15);
	});

	it("getDayStats reports breakMinutes from completed and interrupted breaks", async () => {
		const { now, localDateKey } = recapTestAnchor();

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
		const result = await recapCaller(USER, db).getDayStats({ localDateKey });

		// SHORT_BREAK completed: 5 min, LONG_BREAK interrupted: 7 min = 12
		expect(result.breakMinutes).toBe(12);
		// No WORK cycles → focus = 0, sessions = 0
		expect(result.focusMinutes).toBe(0);
		expect(result.sessionCount).toBe(0);
	});

	it("getDayStats paused-then-stopped cycle counts only pre-pause elapsed", async () => {
		const { now, localDateKey } = recapTestAnchor();

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
		const result = await recapCaller(USER, db).getDayStats({ localDateKey });

		// Only 5 min of actual focus (not the paused span)
		expect(result.focusMinutes).toBe(5);
		expect(result.sessionCount).toBe(0);
	});
});
