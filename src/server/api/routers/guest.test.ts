import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestSnapshotV1 } from "~/lib/guest/schema";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
};

type CycleRow = {
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: "WORK";
	state: "RUNNING" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
};

let tasks: TaskRow[] = [];
let cycles: CycleRow[] = [];
let sessions: Array<{ id: number; userId: string }> = [];
let nextTaskId = 1;
let nextCycleId = 1;
let nextSessionId = 1;

vi.mock("~/server/db/index", () => ({
	db: {
		$transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
			fn({
				task: {
					findMany: vi.fn(() =>
						Promise.resolve(tasks.map((task) => ({ title: task.title }))),
					),
					create: vi.fn((args: { data: Omit<TaskRow, "id"> }) => {
						const row: TaskRow = { id: nextTaskId++, ...args.data };
						tasks.push(row);
						return Promise.resolve(row);
					}),
				},
				session: {
					create: vi.fn((args: { data: { userId: string } }) => {
						const row = { id: nextSessionId++, userId: args.data.userId };
						sessions.push(row);
						return Promise.resolve(row);
					}),
				},
				cycle: {
					updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
					create: vi.fn((args: { data: Omit<CycleRow, "id"> }) => {
						const row: CycleRow = { id: nextCycleId++, ...args.data };
						cycles.push(row);
						return Promise.resolve(row);
					}),
				},
			}),
		),
	},
}));

const { createCallerFactory } = await import("~/server/api/trpc");
const { guestRouter } = await import("~/server/api/routers/guest");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(guestRouter);

describe("guest.import", () => {
	beforeEach(() => {
		tasks = [
			{
				id: 1,
				title: "Foo",
				status: "active",
				userId: "user-1",
				workType: "OPERATIONAL",
				weight: 2,
			},
		];
		cycles = [];
		sessions = [];
		nextTaskId = 2;
		nextCycleId = 1;
		nextSessionId = 1;
	});

	it("imports guest tasks with title suffix on collision and remaps cycle FKs", async () => {
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440001",
					title: "Foo",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
				{
					id: "550e8400-e29b-41d4-a716-446655440002",
					title: "Bar",
					status: "active",
					workType: "DEEP_WORK",
					weight: 3,
					createdAt: new Date("2026-05-29T10:05:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [
				{
					id: "660e8400-e29b-41d4-a716-446655440000",
					state: "ACTIVE",
					startedAt: new Date("2026-05-29T10:00:00.000Z"),
					endedAt: null,
					lastActivityAt: new Date("2026-05-29T10:00:00.000Z"),
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: "770e8400-e29b-41d4-a716-446655440000",
					sessionId: "660e8400-e29b-41d4-a716-446655440000",
					taskId: "550e8400-e29b-41d4-a716-446655440002",
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 900,
					startedAt: new Date(Date.now() - 60_000),
					endedAt: null,
				},
			],
		};

		const caller = createCaller({
			db: db as never,
			session: {
				user: {
					id: "user-1",
					email: "test@example.com",
					name: "Test User",
				},
			},
			headers: new Headers(),
		});

		const result = await caller.import(snapshot);

		expect(result.importedTasks).toBe(2);
		expect(result.importedCycles).toBe(1);
		expect(tasks.map((task) => task.title).sort()).toEqual([
			"Bar",
			"Foo",
			"Foo (2)",
		]);
		expect(cycles[0]?.taskId).toBe(3);
		expect(cycles[0]?.state).toBe("RUNNING");
	});
});
