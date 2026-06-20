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
const DATE_KEY = "2026-06-20";
const NOW = new Date("2026-06-20T12:00:00Z");

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
						state?: string;
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
						rows = rows.filter((c) => c.state === args.where.state);
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
						status?: string;
						updatedAt?: { gte: Date };
						OR?: Array<{ status: string } | { isDailyStanding: boolean }>;
					};
				}) => {
					let rows = tasks.filter((t) => t.userId === args.where.userId);
					if (args.where.status != null) {
						rows = rows.filter((t) => t.status === args.where.status);
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
		tasks.push(
			{
				id: 1,
				userId: USER,
				title: "Write recap",
				status: "active",
				isDailyStanding: false,
				effortMinutes: 25,
				sortOrder: 0,
				createdAt: NOW,
				updatedAt: NOW,
			},
			{
				id: 2,
				userId: USER,
				title: "Review PR",
				status: "active",
				isDailyStanding: false,
				effortMinutes: 15,
				sortOrder: 1,
				createdAt: NOW,
				updatedAt: NOW,
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
				startedAt: new Date("2026-06-20T10:00:00Z"),
				endedAt: new Date("2026-06-20T10:15:00Z"),
				task: { id: 1, title: "Write recap" },
			},
			{
				id: 11,
				userId: USER,
				taskId: 2,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-06-20T11:00:00Z"),
				endedAt: new Date("2026-06-20T11:10:00Z"),
				task: { id: 2, title: "Review PR" },
			},
		);

		const db = createMockDb();
		const result = await recapCaller(USER, db).getDaily({
			localDateKey: DATE_KEY,
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
});
