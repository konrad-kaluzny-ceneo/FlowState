import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

let cycles: Array<{
	id: number;
	userId: string;
	kind: string;
	checkIn: { energy: string } | null;
}> = [];
let sessions: Array<{ id: number; userId: string; state: string }> = [];
let tasks: Array<{
	id: number;
	userId: string;
	status: string;
	isDailyStanding?: boolean;
	workType?: string;
	weight?: number;
	importance?: number;
	urgency?: number;
	effortMinutes?: number | null;
	commitmentHorizon?: string;
	sortOrder?: number;
	createdAt?: Date;
}> = [];

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
					return Promise.resolve({
						...cycle,
						...(args.include?.checkIn
							? { checkIn: cycle.checkIn ?? null }
							: {}),
						...(args.include?.session
							? {
									session: {
										id: 1,
										interruptionCount: 0,
									},
								}
							: {}),
					});
				},
			),
			count: vi.fn(() => Promise.resolve(0)),
		},
		session: {
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					sessions.find(
						(s) => s.id === args.where.id && s.userId === args.where.userId,
					) ?? null,
				);
			}),
		},
		task: {
			findMany: vi.fn((args: { where: { userId?: string } }) => {
				return Promise.resolve(
					tasks.filter(
						(t) => args.where.userId == null || t.userId === args.where.userId,
					),
				);
			}),
			findFirst: vi.fn(
				(args: {
					where: { id?: number; userId?: string; status?: string };
				}) => {
					return Promise.resolve(
						tasks.find((t) => {
							if (args.where.id != null && t.id !== args.where.id) {
								return false;
							}
							if (args.where.userId != null && t.userId !== args.where.userId) {
								return false;
							}
							if (args.where.status != null && t.status !== args.where.status) {
								return false;
							}
							return true;
						}) ?? null,
					);
				},
			),
		},
		suggestionDecision: {
			findFirst: vi.fn(() => Promise.resolve(null)),
			upsert: vi.fn(),
			create: vi.fn(),
			count: vi.fn(() => Promise.resolve(0)),
		},
		taskDayCompletion: {
			findMany: vi.fn(() => Promise.resolve([])),
		},
		dayPlan: {
			findUnique: vi.fn(() => Promise.resolve(null)),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { suggestionRouter } = await import("~/server/api/routers/suggestion");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(suggestionRouter);

describe("suggestion router isolation", () => {
	beforeEach(() => {
		cycles = [];
		sessions = [];
		tasks = [];
		vi.clearAllMocks();
	});

	it("recordDecision rejects cross-user cycle", async () => {
		cycles = [
			{
				id: 1,
				userId: "victim",
				kind: "WORK",
				checkIn: { energy: "STEADY" },
			},
		];
		tasks = [
			{ id: 10, userId: "attacker", status: "active" },
			{ id: 11, userId: "attacker", status: "active" },
		];

		const caller = createCaller({
			db: db as never,
			session: {
				user: { id: "attacker", email: "a@example.com", name: "A" },
			},
			headers: new Headers(),
		});

		await expect(
			caller.recordDecision({
				context: "post_check_in",
				cycleId: 1,
				suggestedTaskId: 10,
				chosenTaskId: 11,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("next rejects cross-user cycle", async () => {
		cycles = [{ id: 1, userId: "victim", kind: "WORK", checkIn: null }];

		const caller = createCaller({
			db: db as never,
			session: {
				user: { id: "attacker", email: "a@example.com", name: "A" },
			},
			headers: new Headers(),
		});

		await expect(
			caller.next({
				context: "post_check_in",
				cycleId: 1,
				localHour: 10,
				localDateKey: "2026-06-19",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("kickoff recordDecision rejects cross-user sessionId", async () => {
		sessions = [{ id: 5, userId: "victim", state: "ACTIVE" }];
		tasks = [
			{ id: 10, userId: "attacker", status: "active" },
			{ id: 11, userId: "attacker", status: "active" },
		];

		const caller = createCaller({
			db: db as never,
			session: {
				user: { id: "attacker", email: "a@example.com", name: "A" },
			},
			headers: new Headers(),
		});

		await expect(
			caller.recordDecision({
				context: "kickoff",
				sessionId: 5,
				suggestedTaskId: 10,
				chosenTaskId: 11,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("kickoff next rejects cross-user sessionId", async () => {
		sessions = [{ id: 5, userId: "victim", state: "ACTIVE" }];

		const caller = createCaller({
			db: db as never,
			session: {
				user: { id: "attacker", email: "a@example.com", name: "A" },
			},
			headers: new Headers(),
		});

		await expect(
			caller.next({
				context: "kickoff",
				sessionId: 5,
				localHour: 10,
				localDateKey: "2026-06-19",
				energy: "STEADY",
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
