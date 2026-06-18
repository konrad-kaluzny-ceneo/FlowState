import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultEisenhowerFields } from "~/lib/data-mode/types";
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
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	personaPresetId: string | null;
};

type CycleWhereState = string | { in: string[] };

type CycleRow = {
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: "WORK";
	state: "RUNNING" | "PAUSED" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	pausedAt?: Date | null;
	remainingDurationSec?: number | null;
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
					aggregate: vi.fn(
						(args: {
							where: { userId: string };
							_max: { sortOrder: true };
						}) => {
							const userTasks = tasks.filter(
								(task) => task.userId === args.where.userId,
							);
							const maxSortOrder = userTasks.reduce(
								(max, task) => Math.max(max, task.sortOrder),
								-1,
							);
							return Promise.resolve({
								_max: {
									sortOrder: maxSortOrder >= 0 ? maxSortOrder : null,
								},
							});
						},
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
					updateMany: vi.fn(
						(args: {
							where: { userId?: string; state?: CycleWhereState };
							data: Partial<
								Pick<
									CycleRow,
									| "state"
									| "endedAt"
									| "pausedAt"
									| "remainingDurationSec"
									| "startedAt"
								>
							>;
						}) => {
							const matchesState = (
								cycleState: CycleRow["state"],
								whereState?: CycleWhereState,
							): boolean => {
								if (whereState == null) {
									return true;
								}
								if (typeof whereState === "string") {
									return cycleState === whereState;
								}
								return whereState.in.includes(cycleState);
							};
							let count = 0;
							for (const cycle of cycles) {
								if (
									args.where.userId != null &&
									cycle.userId !== args.where.userId
								) {
									continue;
								}
								if (!matchesState(cycle.state, args.where.state)) {
									continue;
								}
								Object.assign(cycle, args.data);
								count++;
							}
							return Promise.resolve({ count });
						},
					),
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
const USER_ID = "user-1";

function guestCaller() {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: USER_ID,
				email: "test@example.com",
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

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
				...defaultEisenhowerFields(2),
				sortOrder: 2,
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
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
				{
					id: "550e8400-e29b-41d4-a716-446655440002",
					title: "Bar",
					status: "active",
					workType: "DEEP_WORK",
					weight: 3,
					...defaultEisenhowerFields(3),
					sortOrder: 1,
					resumeNote: null,
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

		const result = await guestCaller().import(snapshot);

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

	it("closes account RUNNING cycles before importing guest snapshot", async () => {
		const preImportCycleId = 99;
		cycles = [
			{
				id: preImportCycleId,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440010",
					title: "Imported task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		};

		const result = await guestCaller().import(snapshot);

		expect(result).toEqual({ importedTasks: 1, importedCycles: 0 });
		const closedCycle = cycles.find((c) => c.id === preImportCycleId);
		expect(closedCycle?.state).toBe("COMPLETED");
		expect(closedCycle?.endedAt).not.toBeNull();
	});

	it("normalizes expired guest RUNNING cycle to COMPLETED with endedAt", async () => {
		const expiredStartedAt = new Date(Date.now() - 60 * 60 * 1000);
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [],
			sessions: [
				{
					id: "660e8400-e29b-41d4-a716-446655440099",
					state: "ACTIVE",
					startedAt: expiredStartedAt,
					endedAt: null,
					lastActivityAt: expiredStartedAt,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: "770e8400-e29b-41d4-a716-446655440099",
					sessionId: "660e8400-e29b-41d4-a716-446655440099",
					taskId: null,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 60,
					startedAt: expiredStartedAt,
					endedAt: null,
				},
			],
		};

		const result = await guestCaller().import(snapshot);

		expect(result.importedCycles).toBe(1);
		expect(cycles).toHaveLength(1);
		expect(cycles[0]?.state).toBe("COMPLETED");
		expect(cycles[0]?.endedAt).not.toBeNull();
	});

	it("returns zero counts for empty snapshot without DB writes", async () => {
		const tasksBefore = tasks.length;
		const cyclesBefore = cycles.length;
		const sessionsBefore = sessions.length;

		const result = await guestCaller().import({
			version: 1,
			tasks: [],
			sessions: [],
			cycles: [],
		});

		expect(result).toEqual({ importedTasks: 0, importedCycles: 0 });
		expect(tasks).toHaveLength(tasksBefore);
		expect(cycles).toHaveLength(cyclesBefore);
		expect(sessions).toHaveLength(sessionsBefore);
	});

	it("preserves guest manual order after existing account tasks on import", async () => {
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440020",
					title: "Guest second",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 1,
					resumeNote: null,
					createdAt: new Date("2026-05-29T10:05:00.000Z"),
					updatedAt: null,
				},
				{
					id: "550e8400-e29b-41d4-a716-446655440021",
					title: "Guest first",
					status: "active",
					workType: "DEEP_WORK",
					weight: 3,
					...defaultEisenhowerFields(3),
					sortOrder: 0,
					resumeNote: null,
					createdAt: new Date("2026-05-29T10:10:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		};

		const result = await guestCaller().import(snapshot);

		expect(result.importedTasks).toBe(2);
		const imported = tasks.filter((task) => task.id > 1);
		expect(imported.map((task) => task.title)).toEqual([
			"Guest first",
			"Guest second",
		]);
		expect(imported.map((task) => task.sortOrder)).toEqual([3, 4]);
	});

	it("preserves Eisenhower task attributes on import", async () => {
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440030",
					title: "ASAP deep work",
					status: "active",
					workType: "DEEP_WORK",
					weight: 3,
					importance: 3,
					urgency: 3,
					effortMinutes: 45,
					commitmentHorizon: "ASAP",
					sortOrder: 0,
					resumeNote: null,
					personaPresetId: null,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		};

		const result = await guestCaller().import(snapshot);

		expect(result.importedTasks).toBe(1);
		const imported = tasks.find((task) => task.title === "ASAP deep work");
		expect(imported).toMatchObject({
			importance: 3,
			urgency: 3,
			weight: 3,
			effortMinutes: 45,
			commitmentHorizon: "ASAP",
		});
	});

	it("preserves personaPresetId on guest import", async () => {
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440031",
					title: "Synchro guest",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					importance: 2,
					urgency: 2,
					effortMinutes: 15,
					commitmentHorizon: "WHEN_POSSIBLE",
					sortOrder: 0,
					resumeNote: null,
					personaPresetId: "synchro",
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		};

		const result = await guestCaller().import(snapshot);

		expect(result.importedTasks).toBe(1);
		const imported = tasks.find((task) => task.title === "Synchro guest");
		expect(imported?.personaPresetId).toBe("synchro");
	});

	it("sets taskId null when guest cycle references unmapped task UUID", async () => {
		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [],
			sessions: [
				{
					id: "660e8400-e29b-41d4-a716-446655440088",
					state: "ACTIVE",
					startedAt: new Date("2026-05-29T10:00:00.000Z"),
					endedAt: null,
					lastActivityAt: new Date("2026-05-29T10:00:00.000Z"),
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: "770e8400-e29b-41d4-a716-446655440088",
					sessionId: "660e8400-e29b-41d4-a716-446655440088",
					taskId: "550e8400-e29b-41d4-a716-446655440099",
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 900,
					startedAt: new Date("2026-05-29T10:00:00.000Z"),
					endedAt: new Date("2026-05-29T10:15:00.000Z"),
				},
			],
		};

		const result = await guestCaller().import(snapshot);

		expect(result.importedCycles).toBe(1);
		expect(cycles[0]?.taskId).toBeNull();
	});
});
