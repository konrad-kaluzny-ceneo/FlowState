import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type CycleRecord = {
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "RUNNING" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
};

type TaskRecord = {
	id: number;
	title: string;
	status: string;
	userId: string;
};

let cycles: CycleRecord[] = [];
let tasks: TaskRecord[] = [];
let sessions: Array<{
	id: number;
	userId: string;
	state: string;
	archivedAt: null;
}>;
let nextCycleId = 1;
let nextSessionId = 1;

vi.mock("~/server/db/index", () => {
	const findCycle = (where: {
		id?: number;
		userId?: string;
		state?: string;
	}) => {
		return (
			cycles.find((c) => {
				if (where.id != null && c.id !== where.id) return false;
				if (where.userId != null && c.userId !== where.userId) return false;
				if (where.state != null && c.state !== where.state) return false;
				return true;
			}) ?? null
		);
	};

	return {
		db: {
			cycle: {
				findFirst: vi.fn(
					(args: {
						where: {
							id?: number;
							userId?: string;
							state?: string;
						};
						include?: { task: boolean };
					}) => {
						const cycle = findCycle(args.where);
						if (!cycle) return Promise.resolve(null);
						if (args.include?.task && cycle.taskId != null) {
							const task = tasks.find((t) => t.id === cycle.taskId) ?? null;
							return Promise.resolve({ ...cycle, task });
						}
						if (args.include?.task) {
							return Promise.resolve({ ...cycle, task: null });
						}
						return Promise.resolve(cycle);
					},
				),
				findMany: vi.fn(() => Promise.resolve(cycles)),
				create: vi.fn(
					(args: {
						data: Omit<CycleRecord, "id" | "state" | "startedAt" | "endedAt">;
					}) => {
						const cycle: CycleRecord = {
							id: nextCycleId++,
							...args.data,
							state: "RUNNING",
							startedAt: new Date(),
							endedAt: null,
						};
						cycles.push(cycle);
						return Promise.resolve(cycle);
					},
				),
				update: vi.fn(
					(args: {
						where: { id: number };
						data: Partial<Pick<CycleRecord, "state" | "endedAt">>;
					}) => {
						const cycle = cycles.find((c) => c.id === args.where.id);
						if (!cycle) throw new Error("not found");
						Object.assign(cycle, args.data);
						return Promise.resolve(cycle);
					},
				),
			},
			session: {
				findFirst: vi.fn(
					(args: {
						where: {
							id?: number;
							userId?: string;
							state?: string;
							archivedAt?: null;
						};
					}) => {
						return Promise.resolve(
							sessions.find((s) => {
								if (args.where.id != null && s.id !== args.where.id)
									return false;
								if (args.where.userId != null && s.userId !== args.where.userId)
									return false;
								if (args.where.state != null && s.state !== args.where.state)
									return false;
								if (args.where.archivedAt === null && s.archivedAt !== null) {
									return false;
								}
								return true;
							}) ?? null,
						);
					},
				),
				create: vi.fn((args: { data: { userId: string } }) => {
					const session = {
						id: nextSessionId++,
						userId: args.data.userId,
						state: "ACTIVE",
						archivedAt: null as null,
					};
					sessions.push(session);
					return Promise.resolve(session);
				}),
			},
			task: {
				findFirst: vi.fn(
					(args: { where: { id?: number; userId?: string } }) => {
						return Promise.resolve(
							tasks.find(
								(t) => t.id === args.where.id && t.userId === args.where.userId,
							) ?? null,
						);
					},
				),
				update: vi.fn(
					(args: { where: { id: number }; data: { status: string } }) => {
						const task = tasks.find((t) => t.id === args.where.id);
						if (!task) throw new Error("not found");
						task.status = args.data.status;
						return Promise.resolve(task);
					},
				),
			},
			$transaction: vi.fn(
				async (fn: (tx: typeof import("~/server/db/index").db) => unknown) => {
					return fn((await import("~/server/db/index")).db);
				},
			),
		},
	};
});

const originalSetTimeout = globalThis.setTimeout;
// biome-ignore lint/suspicious/noExplicitAny: test utility override
globalThis.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as any;

const { createCallerFactory } = await import("~/server/api/trpc");
const { cycleRouter } = await import("~/server/api/routers/cycle");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(cycleRouter);

const USER_ID = "user-test-1";

function caller() {
	return createCaller({
		db: db as never,
		session: {
			user: { id: USER_ID, email: "test@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

describe("cycle router lifecycle", () => {
	beforeEach(() => {
		cycles = [];
		tasks = [];
		sessions = [];
		nextCycleId = 1;
		nextSessionId = 1;
		vi.clearAllMocks();
	});

	it("getActive returns null when no running cycle", async () => {
		const result = await caller().getActive();
		expect(result).toBeNull();
	});

	it("getActive returns running cycle with task", async () => {
		tasks = [
			{ id: 10, title: "Focus task", status: "active", userId: USER_ID },
		];
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: 10,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		const result = await caller().getActive();
		expect(result).toMatchObject({ id: 1, state: "RUNNING", taskId: 10 });
		expect(result?.task).toMatchObject({ id: 10, title: "Focus task" });
	});

	it("complete transitions cycle to COMPLETED", async () => {
		cycles = [
			{
				id: 1,
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

		const updated = await caller().complete({ cycleId: 1 });
		expect(updated.state).toBe("COMPLETED");
		expect(updated.endedAt).not.toBeNull();
	});

	it("complete with markTaskDone updates task status", async () => {
		tasks = [{ id: 5, title: "Done task", status: "active", userId: USER_ID }];
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: 5,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		await caller().complete({ cycleId: 1, markTaskDone: true });
		expect(tasks[0]?.status).toBe("completed");
	});

	it("interrupt sets INTERRUPTED state", async () => {
		cycles = [
			{
				id: 1,
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

		const updated = await caller().interrupt({ cycleId: 1 });
		expect(updated.state).toBe("INTERRUPTED");
		expect(updated.endedAt).not.toBeNull();
	});

	it("interrupt throws NOT_FOUND for another user's cycle", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: "other-user",
				taskId: null,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		await expect(caller().interrupt({ cycleId: 1 })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("complete throws BAD_REQUEST when cycle is not RUNNING", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: new Date(),
			},
		];

		await expect(caller().complete({ cycleId: 1 })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("integration: complete without markTaskDone leaves task active", async () => {
		tasks = [
			{ id: 8, title: "Keep active", status: "active", userId: USER_ID },
		];
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: 8,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		await caller().complete({ cycleId: 1, markTaskDone: false });
		expect(tasks[0]?.status).toBe("active");
		expect(cycles[0]?.state).toBe("COMPLETED");
	});

	it("complete throws NOT_FOUND for another user's cycle", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: "other-user",
				taskId: null,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		await expect(caller().complete({ cycleId: 1 })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("integration: create → getActive → complete → getActive null", async () => {
		sessions = [{ id: 1, userId: USER_ID, state: "ACTIVE", archivedAt: null }];
		tasks = [{ id: 2, title: "Task", status: "active", userId: USER_ID }];

		const c = caller();
		const created = await c.create({
			sessionId: 1,
			kind: "WORK",
			configuredDurationSec: 1500,
			taskId: 2,
		});
		expect(created.state).toBe("RUNNING");

		const active = await c.getActive();
		expect(active?.id).toBe(created.id);

		await c.complete({ cycleId: created.id });
		const after = await c.getActive();
		expect(after).toBeNull();
	});

	it("create without sessionId auto-creates active session", async () => {
		tasks = [{ id: 3, title: "Task", status: "active", userId: USER_ID }];

		const created = await caller().create({
			kind: "WORK",
			configuredDurationSec: 1500,
			taskId: 3,
		});

		expect(created.sessionId).toBe(1);
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.userId).toBe(USER_ID);
	});
});
