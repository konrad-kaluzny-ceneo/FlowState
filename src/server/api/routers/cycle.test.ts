import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type CycleWhereState = string | { in: string[] };

type CycleRecord = {
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "RUNNING" | "PAUSED" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	pausedAt?: Date | null;
	remainingDurationSec?: number | null;
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
	lastActivityAt: Date;
	interruptionCount: number;
}>;
let nextCycleId = 1;
let nextSessionId = 1;
let dayPlans: Array<{
	id: number;
	userId: string;
	localDateKey: string;
	focusBudgetMinutes: number;
	usedFocusMinutes: number;
}> = [];
let nextDayPlanId = 1;

vi.mock("~/server/db/index", () => {
	const matchesState = (
		cycleState: CycleRecord["state"],
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

	const findCycle = (where: {
		id?: number;
		userId?: string;
		state?: CycleWhereState;
	}) => {
		return (
			cycles.find((c) => {
				if (where.id != null && c.id !== where.id) return false;
				if (where.userId != null && c.userId !== where.userId) return false;
				if (!matchesState(c.state, where.state)) return false;
				return true;
			}) ?? null
		);
	};

	const findLatestCycle = (where: {
		userId?: string;
		state?: CycleWhereState;
	}) => {
		const matching = cycles.filter((c) => {
			if (where.userId != null && c.userId !== where.userId) return false;
			if (!matchesState(c.state, where.state)) return false;
			return true;
		});
		matching.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
		return matching[0] ?? null;
	};

	return {
		db: {
			cycle: {
				findFirst: vi.fn(
					(args: {
						where: {
							id?: number;
							userId?: string;
							state?: CycleWhereState;
						};
						orderBy?: { startedAt: "desc" };
						include?: { task: boolean };
					}) => {
						const cycle =
							args.orderBy?.startedAt === "desc" && args.where.id == null
								? findLatestCycle(args.where)
								: findCycle(args.where);
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
				findMany: vi.fn(
					(args?: {
						where?: {
							userId?: string;
							sessionId?: number;
						};
					}) => {
						return Promise.resolve(
							cycles.filter((c) => {
								if (
									args?.where?.userId != null &&
									c.userId !== args.where.userId
								) {
									return false;
								}
								if (
									args?.where?.sessionId != null &&
									c.sessionId !== args.where.sessionId
								) {
									return false;
								}
								return true;
							}),
						);
					},
				),
				count: vi.fn(
					(args: {
						where: {
							userId?: string;
							sessionId?: number;
							kind?: string;
							state?: string;
						};
					}) => {
						const matching = cycles.filter((c) => {
							if (args.where.userId != null && c.userId !== args.where.userId) {
								return false;
							}
							if (
								args.where.sessionId != null &&
								c.sessionId !== args.where.sessionId
							) {
								return false;
							}
							if (args.where.kind != null && c.kind !== args.where.kind) {
								return false;
							}
							if (args.where.state != null && c.state !== args.where.state) {
								return false;
							}
							return true;
						});
						return Promise.resolve(matching.length);
					},
				),
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
						data: Partial<
							Pick<
								CycleRecord,
								| "state"
								| "endedAt"
								| "taskId"
								| "pausedAt"
								| "remainingDurationSec"
								| "startedAt"
							>
						>;
						include?: { task: boolean };
					}) => {
						const cycle = cycles.find((c) => c.id === args.where.id);
						if (!cycle) throw new Error("not found");
						Object.assign(cycle, args.data);
						if (args.include?.task) {
							const task =
								cycle.taskId != null
									? (tasks.find((t) => t.id === cycle.taskId) ?? null)
									: null;
							return Promise.resolve({ ...cycle, task });
						}
						return Promise.resolve(cycle);
					},
				),
				updateMany: vi.fn(
					(args: {
						where: {
							id?: number;
							userId?: string;
							state?: CycleWhereState;
						};
						data: Partial<
							Pick<
								CycleRecord,
								| "state"
								| "endedAt"
								| "pausedAt"
								| "remainingDurationSec"
								| "startedAt"
							>
						>;
					}) => {
						const matching = cycles.filter((c) => {
							if (args.where.id != null && c.id !== args.where.id) return false;
							if (args.where.userId != null && c.userId !== args.where.userId)
								return false;
							if (!matchesState(c.state, args.where.state)) return false;
							return true;
						});
						for (const cycle of matching) {
							Object.assign(cycle, args.data);
						}
						return Promise.resolve({ count: matching.length });
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
						lastActivityAt: new Date(),
						interruptionCount: 0,
					};
					sessions.push(session);
					return Promise.resolve(session);
				}),
				update: vi.fn(
					(args: {
						where: { id: number };
						data: {
							lastActivityAt?: Date;
							interruptionCount?: { increment: number };
						};
					}) => {
						const session = sessions.find((s) => s.id === args.where.id);
						if (!session) throw new Error("session not found");
						if (args.data.lastActivityAt != null) {
							session.lastActivityAt = args.data.lastActivityAt;
						}
						if (args.data.interruptionCount?.increment != null) {
							session.interruptionCount +=
								args.data.interruptionCount.increment;
						}
						return Promise.resolve(session);
					},
				),
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
			dayPlan: {
				findUnique: vi.fn(
					(args: {
						where:
							| { id: number }
							| {
									day_plan_user_date_key: {
										userId: string;
										localDateKey: string;
									};
							  };
					}) => {
						if ("id" in args.where) {
							const whereById = args.where;
							return Promise.resolve(
								dayPlans.find((plan) => plan.id === whereById.id) ?? null,
							);
						}
						const { userId, localDateKey } = args.where.day_plan_user_date_key;
						return Promise.resolve(
							dayPlans.find(
								(plan) =>
									plan.userId === userId && plan.localDateKey === localDateKey,
							) ?? null,
						);
					},
				),
				update: vi.fn(
					(args: {
						where: { id: number };
						data:
							| { usedFocusMinutes: number }
							| { usedFocusMinutes: { increment: number } };
					}) => {
						const plan = dayPlans.find((row) => row.id === args.where.id);
						if (plan == null) {
							throw new Error("day plan not found");
						}
						const used = args.data.usedFocusMinutes;
						if (
							typeof used === "object" &&
							used !== null &&
							"increment" in used
						) {
							plan.usedFocusMinutes += used.increment;
						} else if (typeof used === "number") {
							plan.usedFocusMinutes = used;
						}
						return Promise.resolve(plan);
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

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { cycleRouter } = await import("~/server/api/routers/cycle");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(cycleRouter);

const USER_ID = "user-test-1";
const VICTIM_ID = "victim-user";
const ATTACKER_ID = "attacker-user";

function callerAs(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: { id: userId, email: "test@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

function caller() {
	return callerAs(USER_ID);
}

describe("cycle router lifecycle", () => {
	beforeEach(() => {
		cycles = [];
		tasks = [];
		sessions = [];
		dayPlans = [];
		nextCycleId = 1;
		nextSessionId = 1;
		nextDayPlanId = 1;
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
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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

	it("complete WORK cycle with localDateKey increments day plan used minutes", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
		dayPlans = [
			{
				id: nextDayPlanId++,
				userId: USER_ID,
				localDateKey: "2026-06-19",
				focusBudgetMinutes: 120,
				usedFocusMinutes: 10,
			},
		];
		const startedAt = new Date(Date.now() - 25 * 60 * 1000);
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt,
				endedAt: null,
			},
		];

		await caller().complete({ cycleId: 1, localDateKey: "2026-06-19" });

		expect(dayPlans[0]?.usedFocusMinutes).toBe(35);
	});

	it("interrupt sets INTERRUPTED state", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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

	it("pause transitions RUNNING to PAUSED with remaining duration", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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

		const updated = await caller().pause({
			cycleId: 1,
			remainingDurationSec: 600,
		});

		expect(updated.state).toBe("PAUSED");
		expect(updated.remainingDurationSec).toBe(600);
		expect(updated.pausedAt).not.toBeNull();
		expect(sessions[0]?.interruptionCount).toBe(0);
	});

	it("pause persists PAUSED state readable through getActive", async () => {
		tasks = [
			{ id: 10, title: "Focus task", status: "active", userId: USER_ID },
		];
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
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

		await caller().pause({
			cycleId: 1,
			remainingDurationSec: 600,
		});

		const active = await caller().getActive();
		expect(active).toMatchObject({
			id: 1,
			sessionId: 1,
			userId: USER_ID,
			taskId: 10,
			kind: "WORK",
			state: "PAUSED",
			remainingDurationSec: 600,
		});
		expect(active?.pausedAt).not.toBeNull();
		expect(active?.task).toMatchObject({ id: 10, title: "Focus task" });
		expect(sessions[0]?.interruptionCount).toBe(0);
	});

	it("resume transitions PAUSED to RUNNING and clears pause fields", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
		const pausedAt = new Date("2026-06-18T10:00:00Z");
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "PAUSED",
				configuredDurationSec: 1500,
				startedAt: new Date("2026-06-18T09:00:00Z"),
				endedAt: null,
				pausedAt,
				remainingDurationSec: 600,
			},
		];

		const updated = await caller().resume({ cycleId: 1 });

		expect(updated.state).toBe("RUNNING");
		expect(updated.pausedAt).toBeNull();
		expect(updated.remainingDurationSec).toBeNull();
		expect(updated.startedAt.getTime()).toBeGreaterThan(pausedAt.getTime());
		const expectedEndMs =
			updated.startedAt.getTime() + updated.configuredDurationSec * 1000;
		expect(expectedEndMs - Date.now()).toBeGreaterThanOrEqual(590_000);
		expect(expectedEndMs - Date.now()).toBeLessThanOrEqual(610_000);
	});

	it("getActive returns PAUSED cycle", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "PAUSED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
				pausedAt: new Date(),
				remainingDurationSec: 420,
			},
		];

		const result = await caller().getActive();
		expect(result).toMatchObject({
			id: 1,
			state: "PAUSED",
			remainingDurationSec: 420,
		});
	});

	it("create throws CONFLICT when user already has PAUSED cycle", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "PAUSED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
				pausedAt: new Date(),
				remainingDurationSec: 300,
			},
		];

		await expect(
			caller().create({
				sessionId: 1,
				kind: "WORK",
				configuredDurationSec: 1500,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("pause throws BAD_REQUEST when cycle is not running", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "PAUSED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: null,
				pausedAt: new Date(),
				remainingDurationSec: 300,
			},
		];

		await expect(
			caller().pause({ cycleId: 1, remainingDurationSec: 100 }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("pause throws BAD_REQUEST when remaining duration exceeds configured duration", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 1,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "RUNNING",
				configuredDurationSec: 600,
				startedAt: new Date(),
				endedAt: null,
			},
		];

		await expect(
			caller().pause({ cycleId: 1, remainingDurationSec: 601 }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("resume throws BAD_REQUEST when cycle is not paused", async () => {
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

		await expect(caller().resume({ cycleId: 1 })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("pause throws NOT_FOUND for another user's cycle", async () => {
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

		await expect(
			caller().pause({ cycleId: 1, remainingDurationSec: 100 }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
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
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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

	it("integration: create â†’ getActive â†’ complete â†’ getActive null", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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
		expect(active).toMatchObject({
			state: "RUNNING",
			taskId: 2,
			kind: "WORK",
			configuredDurationSec: 1500,
		});
		expect(active?.task).toMatchObject({ id: 2, title: "Task" });
		expect(active?.startedAt).toBeInstanceOf(Date);

		await c.complete({ cycleId: created.id });
		const after = await c.getActive();
		expect(after).toBeNull();
	});

	it("create throws CONFLICT when user already has RUNNING cycle", async () => {
		sessions = [
			{
				id: 1,
				userId: USER_ID,
				state: "ACTIVE",
				archivedAt: null,
				lastActivityAt: new Date(),
				interruptionCount: 0,
			},
		];
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

		await expect(
			caller().create({
				sessionId: 1,
				kind: "WORK",
				configuredDurationSec: 1500,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
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

	describe("lastActivityAt updates", () => {
		it("create updates session lastActivityAt", async () => {
			const oldDate = new Date("2026-01-01T00:00:00Z");
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: oldDate,
					interruptionCount: 0,
				},
			];

			await caller().create({
				sessionId: 1,
				kind: "WORK",
				configuredDurationSec: 1500,
			});

			expect(sessions[0]?.lastActivityAt.getTime()).toBeGreaterThan(
				oldDate.getTime(),
			);
		});

		it("complete updates session lastActivityAt", async () => {
			const oldDate = new Date("2026-01-01T00:00:00Z");
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: oldDate,
					interruptionCount: 0,
				},
			];
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

			await caller().complete({ cycleId: 1 });

			expect(sessions[0]?.lastActivityAt.getTime()).toBeGreaterThan(
				oldDate.getTime(),
			);
		});

		it("interrupt updates session lastActivityAt", async () => {
			const oldDate = new Date("2026-01-01T00:00:00Z");
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: oldDate,
					interruptionCount: 0,
				},
			];
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

			await caller().interrupt({ cycleId: 1 });

			expect(sessions[0]?.lastActivityAt.getTime()).toBeGreaterThan(
				oldDate.getTime(),
			);
		});
	});

	describe("rebindTask", () => {
		it("swaps taskId on a running WORK cycle", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			tasks = [
				{ id: 10, title: "First", status: "active", userId: USER_ID },
				{ id: 11, title: "Second", status: "active", userId: USER_ID },
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
					startedAt: new Date("2026-06-06T10:00:00Z"),
					endedAt: null,
				},
			];

			const result = await caller().rebindTask({ cycleId: 1, taskId: 11 });
			expect(result.taskId).toBe(11);
			expect(result.task).toMatchObject({ id: 11, title: "Second" });
			expect(result.startedAt).toEqual(new Date("2026-06-06T10:00:00Z"));
			expect(result.configuredDurationSec).toBe(1500);
			expect(cycles[0]?.taskId).toBe(11);
		});

		it("increments session interruptionCount on rebind", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			tasks = [
				{ id: 10, title: "First", status: "active", userId: USER_ID },
				{ id: 11, title: "Second", status: "active", userId: USER_ID },
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

			await caller().rebindTask({ cycleId: 1, taskId: 11 });
			expect(sessions[0]?.interruptionCount).toBe(1);
		});

		it("increments interruptionCount when complete with incrementInterruption flag", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			await caller().complete({ cycleId: 1, incrementInterruption: true });
			expect(sessions[0]?.interruptionCount).toBe(1);
		});

		it("does not increment interruptionCount on normal complete", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			await caller().complete({ cycleId: 1 });
			expect(sessions[0]?.interruptionCount).toBe(0);
		});

		it("throws NOT_FOUND for another user's cycle", async () => {
			sessions = [
				{
					id: 1,
					userId: VICTIM_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			tasks = [{ id: 10, title: "Mine", status: "active", userId: USER_ID }];
			cycles = [
				{
					id: 1,
					sessionId: 1,
					userId: VICTIM_ID,
					taskId: null,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: null,
				},
			];

			await expect(
				callerAs(ATTACKER_ID).rebindTask({ cycleId: 1, taskId: 10 }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});
	});

	describe("cross-user IDOR isolation", () => {
		it("getActive returns null when only another user has a RUNNING cycle", async () => {
			cycles = [
				{
					id: 1,
					sessionId: 1,
					userId: VICTIM_ID,
					taskId: null,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: null,
				},
			];

			const result = await callerAs(ATTACKER_ID).getActive();
			expect(result).toBeNull();
		});

		it("countCompletedWork returns 0 for another user's sessionId", async () => {
			sessions = [
				{
					id: 10,
					userId: VICTIM_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			cycles = [
				{
					id: 1,
					sessionId: 10,
					userId: VICTIM_ID,
					taskId: null,
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: new Date(),
				},
			];

			const count = await callerAs(ATTACKER_ID).countCompletedWork({
				sessionId: 10,
			});
			expect(count).toBe(0);
		});

		it("list returns empty when querying another user's sessionId", async () => {
			sessions = [
				{
					id: 20,
					userId: VICTIM_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			cycles = [
				{
					id: 1,
					sessionId: 20,
					userId: VICTIM_ID,
					taskId: null,
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: new Date(),
				},
			];

			const result = await callerAs(ATTACKER_ID).list({ sessionId: 20 });
			expect(result).toEqual([]);
		});

		it("documents getActive when session ended but cycle still RUNNING", async () => {
			// getActive filters userId + RUNNING only â€” no session state join (cycle.ts:37-45)
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ENDED",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			const result = await caller().getActive();
			expect(result).toMatchObject({ id: 1, state: "RUNNING" });
		});
	});

	describe("router ownership oracles", () => {
		it("list scopes findMany by caller userId and optional sessionId", async () => {
			sessions = [
				{
					id: 7,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			cycles = [
				{
					id: 1,
					sessionId: 7,
					userId: USER_ID,
					taskId: null,
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: new Date(),
				},
			];

			await caller().list({ sessionId: 7 });

			expect(db.cycle.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { userId: USER_ID, sessionId: 7 },
				}),
			);
		});

		it("complete updateMany scopes by cycle id, userId, and RUNNING state", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			await caller().complete({ cycleId: 1 });

			expect(db.cycle.updateMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						id: 1,
						userId: USER_ID,
						state: "RUNNING",
					},
				}),
			);
		});

		it("complete returns BAD_REQUEST when updateMany affects zero rows", async () => {
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

		it("complete with markTaskDone scopes task update by id and userId", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
			tasks = [
				{ id: 5, title: "Done task", status: "active", userId: USER_ID },
			];
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

			expect(db.task.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 5, userId: USER_ID },
					data: { status: "completed" },
				}),
			);
		});

		it("complete without markTaskDone does not update task", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			expect(db.task.update).not.toHaveBeenCalled();
		});

		it("complete with incrementInterruption increments session interruptionCount", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					interruptionCount: 0,
				},
			];
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

			await caller().complete({ cycleId: 1, incrementInterruption: true });

			expect(db.session.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1 },
					data: expect.objectContaining({
						interruptionCount: { increment: 1 },
					}),
				}),
			);
		});

		it("complete on foreign cycle scopes findFirst and skips writes", async () => {
			cycles = [
				{
					id: 1,
					sessionId: 1,
					userId: VICTIM_ID,
					taskId: null,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 1500,
					startedAt: new Date(),
					endedAt: null,
				},
			];

			await expect(
				callerAs(ATTACKER_ID).complete({ cycleId: 1 }),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			expect(db.cycle.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1, userId: ATTACKER_ID },
				}),
			);
			expect(db.cycle.updateMany).not.toHaveBeenCalled();
			expect(db.task.update).not.toHaveBeenCalled();
		});
	});
});
