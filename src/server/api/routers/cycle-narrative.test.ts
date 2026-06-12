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
	intention: string | null;
};

type TaskRecord = {
	id: number;
	status: string;
	userId: string;
};

type CheckInRecord = {
	id: number;
	cycleId: number;
	userId: string;
	energy: "FOCUSED" | "STEADY" | "FADING";
	respondedAt: Date;
};

let cycles: CycleRecord[] = [];
let tasks: TaskRecord[] = [];
let checkIns: CheckInRecord[] = [];
let sessions: Array<{ id: number; userId: string; state: string }> = [];
let nextCycleId = 1;

vi.mock("~/server/db/index", () => ({
	db: {
		cycle: {
			count: vi.fn(
				(args: {
					where: {
						userId?: string;
						sessionId?: number;
						kind?: string;
						state?: string;
						task?: { status: string };
					};
				}) => {
					const matching = cycles.filter((cycle) => {
						if (
							args.where.userId != null &&
							cycle.userId !== args.where.userId
						) {
							return false;
						}
						if (
							args.where.sessionId != null &&
							cycle.sessionId !== args.where.sessionId
						) {
							return false;
						}
						if (args.where.kind != null && cycle.kind !== args.where.kind) {
							return false;
						}
						if (args.where.state != null && cycle.state !== args.where.state) {
							return false;
						}
						if (args.where.task?.status != null) {
							const task = tasks.find((t) => t.id === cycle.taskId);
							if (task?.status !== args.where.task.status) {
								return false;
							}
						}
						return true;
					});
					return Promise.resolve(matching.length);
				},
			),
			findFirst: vi.fn(() => Promise.resolve(null)),
			create: vi.fn(),
		},
		checkIn: {
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						cycle?: { sessionId?: number };
					};
					orderBy?: { respondedAt: "desc" };
					select?: { energy: true };
				}) => {
					const matching = checkIns.filter((checkIn) => {
						if (
							args.where.userId != null &&
							checkIn.userId !== args.where.userId
						) {
							return false;
						}
						const cycle = cycles.find((c) => c.id === checkIn.cycleId);
						if (
							args.where.cycle?.sessionId != null &&
							cycle?.sessionId !== args.where.cycle.sessionId
						) {
							return false;
						}
						return true;
					});

					if (args.orderBy?.respondedAt === "desc") {
						matching.sort(
							(a, b) => b.respondedAt.getTime() - a.respondedAt.getTime(),
						);
					}

					const latest = matching[0];
					if (latest == null) {
						return Promise.resolve(null);
					}

					return Promise.resolve({ energy: latest.energy });
				},
			),
		},
		session: {
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				const session = sessions.find((s) => {
					if (args.where.id != null && s.id !== args.where.id) return false;
					if (args.where.userId != null && s.userId !== args.where.userId) {
						return false;
					}
					return true;
				});
				return Promise.resolve(session ?? null);
			}),
		},
		$transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
			fn({
				cycle: {
					findFirst: vi.fn(() => Promise.resolve(null)),
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
								intention: args.data.intention ?? null,
							};
							cycles.push(cycle);
							return Promise.resolve(cycle);
						},
					),
				},
				session: {
					update: vi.fn(() => Promise.resolve({})),
				},
			}),
		),
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { cycleRouter } = await import("~/server/api/routers/cycle");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(cycleRouter);
const USER_ID = "user-cycle-narrative";

function cycleCaller() {
	return createCaller({
		db: db as never,
		session: {
			user: { id: USER_ID, email: "t@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

describe("cycle narrative queries", () => {
	beforeEach(() => {
		cycles = [];
		tasks = [];
		checkIns = [];
		sessions = [{ id: 10, userId: USER_ID, state: "ACTIVE" }];
		nextCycleId = 1;
		vi.clearAllMocks();
	});

	it("countTasksCompletedInSession counts completed work cycles with completed tasks", async () => {
		tasks = [
			{ id: 1, status: "completed", userId: USER_ID },
			{ id: 2, status: "active", userId: USER_ID },
		];
		cycles = [
			{
				id: 1,
				sessionId: 10,
				userId: USER_ID,
				taskId: 1,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: new Date(),
				intention: null,
			},
			{
				id: 2,
				sessionId: 10,
				userId: USER_ID,
				taskId: 2,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: new Date(),
				intention: null,
			},
		];

		const count = await cycleCaller().countTasksCompletedInSession({
			sessionId: 10,
		});

		expect(count).toBe(1);
	});

	it("getLatestCheckInEnergy returns the newest check-in energy for the session", async () => {
		cycles = [
			{
				id: 1,
				sessionId: 10,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: new Date(),
				intention: null,
			},
			{
				id: 2,
				sessionId: 10,
				userId: USER_ID,
				taskId: null,
				kind: "WORK",
				state: "COMPLETED",
				configuredDurationSec: 1500,
				startedAt: new Date(),
				endedAt: new Date(),
				intention: null,
			},
		];
		checkIns = [
			{
				id: 1,
				cycleId: 1,
				userId: USER_ID,
				energy: "STEADY",
				respondedAt: new Date("2025-01-01"),
			},
			{
				id: 2,
				cycleId: 2,
				userId: USER_ID,
				energy: "FADING",
				respondedAt: new Date("2025-06-01"),
			},
		];

		const energy = await cycleCaller().getLatestCheckInEnergy({
			sessionId: 10,
		});

		expect(energy).toBe("FADING");
	});

	it("create persists optional cycle intention", async () => {
		const cycle = await cycleCaller().create({
			sessionId: 10,
			kind: "WORK",
			configuredDurationSec: 1500,
			intention: "Ship closure overlay",
		});

		expect(cycle.intention).toBe("Ship closure overlay");
	});
});
