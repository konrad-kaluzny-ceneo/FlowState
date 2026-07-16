import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildDailyRecap } from "~/lib/recap/build-daily-recap";

type CycleRow = {
	id: number;
	userId: string;
	taskId: number | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "COMPLETED" | "RUNNING" | "INTERRUPTED" | "PAUSED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	task: {
		id: number;
		title: string;
		workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
		effortMinutes: number | null;
		status: string;
	} | null;
};

type TaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
	isDailyStanding: boolean;
	effortMinutes: number | null;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
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

const USER = "recap-user";
const DATE_KEY = "2026-06-20";
const NOW = new Date("2026-06-20T12:00:00Z");

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
					orderBy?: unknown;
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

describe("buildDailyRecap", () => {
	beforeEach(() => {
		cycles = [];
		tasks = [];
		completions = [];
	});

	it("rolls up last 24h focused minutes per task", async () => {
		tasks.push({
			id: 1,
			userId: USER,
			title: "Write recap",
			status: "completed",
			isDailyStanding: false,
			effortMinutes: 25,
			workType: "DEEP_WORK",
			sortOrder: 0,
			createdAt: NOW,
			updatedAt: NOW,
		});

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
				task: {
					id: 1,
					title: "Write recap",
					workType: "DEEP_WORK",
					effortMinutes: 25,
					status: "completed",
				},
			},
			{
				id: 11,
				userId: USER,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-06-20T11:00:00Z"),
				endedAt: new Date("2026-06-20T11:10:00Z"),
				task: {
					id: 1,
					title: "Write recap",
					workType: "DEEP_WORK",
					effortMinutes: 25,
					status: "completed",
				},
			},
		);

		const recap = await buildDailyRecap(
			createMockDb() as never,
			USER,
			DATE_KEY,
			NOW,
		);

		expect(recap.last24Hours).toHaveLength(1);
		expect(recap.last24Hours[0]).toMatchObject({
			taskId: 1,
			title: "Write recap",
			focusedMinutes: 25,
			workType: "DEEP_WORK",
			effortMinutes: 25,
			isCompleted: true,
		});
		expect(recap.footprints["1"]).toEqual({
			lastFocusedAt: new Date("2026-06-20T11:10:00Z"),
			cumulativeMinutes: 25,
		});
	});

	it("includes mark-done-without-cycle rows in last 24h", async () => {
		tasks.push({
			id: 2,
			userId: USER,
			title: "Quick close",
			status: "completed",
			isDailyStanding: false,
			effortMinutes: null,
			workType: "OPERATIONAL",
			sortOrder: 0,
			createdAt: NOW,
			updatedAt: new Date("2026-06-20T11:30:00Z"),
		});

		const recap = await buildDailyRecap(
			createMockDb() as never,
			USER,
			DATE_KEY,
			NOW,
		);

		expect(recap.last24Hours).toHaveLength(1);
		expect(recap.last24Hours[0]).toMatchObject({
			taskId: 2,
			focusedMinutes: 0,
			workType: "OPERATIONAL",
			effortMinutes: null,
			isCompleted: true,
			completedWithoutCycle: true,
		});
	});

	it("builds today plan from active and standing tasks", async () => {
		tasks.push(
			{
				id: 3,
				userId: USER,
				title: "Active task",
				status: "active",
				isDailyStanding: false,
				effortMinutes: 30,
				workType: "DEEP_WORK",
				sortOrder: 0,
				createdAt: NOW,
				updatedAt: NOW,
			},
			{
				id: 4,
				userId: USER,
				title: "Standing",
				status: "active",
				isDailyStanding: true,
				effortMinutes: 15,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: NOW,
				updatedAt: NOW,
			},
		);

		const recap = await buildDailyRecap(
			createMockDb() as never,
			USER,
			DATE_KEY,
			NOW,
		);

		expect(recap.todayPlan.map((row) => row.taskId)).toEqual([3, 4]);
	});

	it("marks cycle rollup rows incomplete when task is still active", async () => {
		tasks.push({
			id: 5,
			userId: USER,
			title: "In progress",
			status: "active",
			isDailyStanding: false,
			effortMinutes: 20,
			workType: "REACTIVE",
			sortOrder: 0,
			createdAt: NOW,
			updatedAt: NOW,
		});

		cycles.push({
			id: 20,
			userId: USER,
			taskId: 5,
			kind: "WORK",
			state: "COMPLETED",
			configuredDurationSec: 1500,
			startedAt: new Date("2026-06-20T09:00:00Z"),
			endedAt: new Date("2026-06-20T09:25:00Z"),
			task: {
				id: 5,
				title: "In progress",
				workType: "REACTIVE",
				effortMinutes: 20,
				status: "active",
			},
		});

		const recap = await buildDailyRecap(
			createMockDb() as never,
			USER,
			DATE_KEY,
			NOW,
		);

		expect(recap.last24Hours[0]).toMatchObject({
			taskId: 5,
			isCompleted: false,
			workType: "REACTIVE",
			effortMinutes: 20,
		});
	});
});
