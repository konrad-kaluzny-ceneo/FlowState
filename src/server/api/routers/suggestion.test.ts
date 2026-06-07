import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type EnergyLevel = "FOCUSED" | "STEADY" | "FADING";
type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";

type CycleRow = {
	id: number;
	sessionId: number;
	userId: string;
	kind: string;
	state: string;
};

type SessionRow = {
	id: number;
	userId: string;
	interruptionCount: number;
};

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	workType: WorkType;
	weight: number;
	createdAt: Date;
};

type CheckInRow = {
	cycleId: number;
	userId: string;
	energy: EnergyLevel;
};

type DecisionRow = {
	id: number;
	cycleId: number;
	userId: string;
	suggestedTaskId: number;
	chosenTaskId: number;
	accepted: boolean;
	createdAt: Date;
	chosenTask: TaskRow;
};

let cycles: CycleRow[] = [];
let sessions: SessionRow[] = [];
let tasks: TaskRow[] = [];
let checkIns: CheckInRow[] = [];
let decisions: DecisionRow[] = [];
let nextDecisionId = 1;

vi.mock("~/server/db/index", () => ({
	db: {
		cycle: {
			findFirst: vi.fn(
				(args: {
					where: { id?: number; userId?: string };
					include?: { session?: boolean; checkIn?: boolean };
				}) => {
					const cycle = cycles.find(
						(c) => c.id === args.where.id && c.userId === args.where.userId,
					);
					if (!cycle) return Promise.resolve(null);
					const session = args.include?.session
						? (sessions.find((s) => s.id === cycle.sessionId) ?? null)
						: undefined;
					const checkIn = args.include?.checkIn
						? (checkIns.find((c) => c.cycleId === cycle.id) ?? null)
						: undefined;
					return Promise.resolve({
						...cycle,
						...(session != null ? { session } : {}),
						...(args.include?.checkIn ? { checkIn: checkIn ?? null } : {}),
					});
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
					const n = cycles.filter((c) => {
						if (args.where.userId != null && c.userId !== args.where.userId)
							return false;
						if (
							args.where.sessionId != null &&
							c.sessionId !== args.where.sessionId
						)
							return false;
						if (args.where.kind != null && c.kind !== args.where.kind)
							return false;
						if (args.where.state != null && c.state !== args.where.state)
							return false;
						return true;
					}).length;
					return Promise.resolve(n);
				},
			),
		},
		session: {
			findFirst: vi.fn(),
		},
		task: {
			findMany: vi.fn(
				(args: { where: { userId?: string; status?: string } }) => {
					return Promise.resolve(
						tasks.filter((t) => {
							if (args.where.userId != null && t.userId !== args.where.userId) {
								return false;
							}
							if (args.where.status != null && t.status !== args.where.status) {
								return false;
							}
							return true;
						}),
					);
				},
			),
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					tasks.find(
						(t) => t.id === args.where.id && t.userId === args.where.userId,
					) ?? null,
				);
			}),
		},
		checkIn: {
			findFirst: vi.fn(),
		},
		suggestionDecision: {
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						accepted?: boolean;
						cycle?: { sessionId?: number };
					};
					orderBy?: { createdAt: "desc" };
					include?: { chosenTask: boolean };
				}) => {
					let rows = decisions.filter((d) => {
						if (args.where.userId != null && d.userId !== args.where.userId)
							return false;
						if (
							args.where.accepted != null &&
							d.accepted !== args.where.accepted
						) {
							return false;
						}
						if (args.where.cycle?.sessionId != null) {
							const cycle = cycles.find((c) => c.id === d.cycleId);
							if (cycle?.sessionId !== args.where.cycle.sessionId) {
								return false;
							}
						}
						return true;
					});
					if (args.orderBy?.createdAt === "desc") {
						rows = [...rows].sort(
							(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
						);
					}
					const row = rows[0] ?? null;
					if (row == null) return Promise.resolve(null);
					if (args.include?.chosenTask) {
						return Promise.resolve(row);
					}
					return Promise.resolve(row);
				},
			),
			upsert: vi.fn(
				(args: {
					where: { cycleId: number };
					create: Omit<DecisionRow, "id" | "createdAt" | "chosenTask">;
					update: Partial<
						Pick<DecisionRow, "suggestedTaskId" | "chosenTaskId" | "accepted">
					>;
				}) => {
					const existing = decisions.find(
						(d) => d.cycleId === args.where.cycleId,
					);
					const chosenTask = tasks.find(
						(t) =>
							t.id === (args.create.chosenTaskId ?? existing?.chosenTaskId),
					);
					if (existing) {
						Object.assign(existing, args.update);
						if (chosenTask) existing.chosenTask = chosenTask;
						return Promise.resolve(existing);
					}
					const row: DecisionRow = {
						id: nextDecisionId++,
						...args.create,
						createdAt: new Date(),
						chosenTask: chosenTask as TaskRow,
					};
					decisions.push(row);
					return Promise.resolve(row);
				},
			),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { suggestionRouter } = await import("~/server/api/routers/suggestion");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(suggestionRouter);
const USER_ID = "suggestion-user";

function caller(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: { id: userId, email: "test@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

describe("suggestion router", () => {
	beforeEach(() => {
		cycles = [];
		sessions = [];
		tasks = [];
		checkIns = [];
		decisions = [];
		nextDecisionId = 1;
		vi.clearAllMocks();
	});

	it("next returns deep task when FOCUSED with mixed candidates", async () => {
		sessions = [{ id: 1, userId: USER_ID, interruptionCount: 0 }];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FOCUSED" }];
		tasks = [
			{
				id: 1,
				title: "Deep feature",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				weight: 3,
				createdAt: new Date("2026-01-01"),
			},
			{
				id: 2,
				title: "Inbox",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				weight: 2,
				createdAt: new Date("2026-01-02"),
			},
		];

		const result = await caller().next({ cycleId: 10, localHour: 10 });

		expect(result).toMatchObject({
			taskId: 1,
			title: "Deep feature",
			workType: "DEEP_WORK",
		});
		expect(result?.rationale).toBeTruthy();
	});

	it("next returns null when no active tasks", async () => {
		sessions = [{ id: 1, userId: USER_ID, interruptionCount: 0 }];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		tasks = [];

		const result = await caller().next({ cycleId: 10, localHour: 10 });
		expect(result).toBeNull();
	});

	it("next throws NOT_FOUND for another user's cycle", async () => {
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: "other-user",
				kind: "WORK",
				state: "COMPLETED",
			},
		];

		await expect(
			caller().next({ cycleId: 10, localHour: 10 }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("next throws BAD_REQUEST without check-in", async () => {
		sessions = [{ id: 1, userId: USER_ID, interruptionCount: 0 }];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];

		await expect(
			caller().next({ cycleId: 10, localHour: 10 }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("recordDecision stores accept vs override", async () => {
		sessions = [{ id: 1, userId: USER_ID, interruptionCount: 0 }];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		tasks = [
			{
				id: 1,
				title: "A",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				weight: 2,
				createdAt: new Date(),
			},
			{
				id: 2,
				title: "B",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				weight: 2,
				createdAt: new Date(),
			},
		];

		const accepted = await caller().recordDecision({
			cycleId: 10,
			suggestedTaskId: 1,
			chosenTaskId: 1,
		});
		expect(accepted.accepted).toBe(true);

		const overridden = await caller().recordDecision({
			cycleId: 10,
			suggestedTaskId: 1,
			chosenTaskId: 2,
		});
		expect(overridden.accepted).toBe(false);
	});

	it("recordDecision throws BAD_REQUEST without check-in", async () => {
		sessions = [{ id: 1, userId: USER_ID, interruptionCount: 0 }];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		tasks = [
			{
				id: 1,
				title: "A",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				weight: 2,
				createdAt: new Date(),
			},
		];

		await expect(
			caller().recordDecision({
				cycleId: 10,
				suggestedTaskId: 1,
				chosenTaskId: 1,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
