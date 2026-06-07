import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

let cycles: Array<{ id: number; userId: string }> = [];
let tasks: Array<{ id: number; userId: string }> = [];

vi.mock("~/server/db/index", () => ({
	db: {
		cycle: {
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					cycles.find(
						(c) => c.id === args.where.id && c.userId === args.where.userId,
					) ?? null,
				);
			}),
		},
		task: {
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					tasks.find(
						(t) => t.id === args.where.id && t.userId === args.where.userId,
					) ?? null,
				);
			}),
		},
		suggestionDecision: {
			upsert: vi.fn(),
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
		tasks = [];
		vi.clearAllMocks();
	});

	it("recordDecision rejects cross-user cycle", async () => {
		cycles = [{ id: 1, userId: "victim" }];
		tasks = [
			{ id: 10, userId: "attacker" },
			{ id: 11, userId: "attacker" },
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
				cycleId: 1,
				suggestedTaskId: 10,
				chosenTaskId: 11,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
