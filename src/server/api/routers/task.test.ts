import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: neon-auth, Property 9: Task creation ownership
 * Validates: Requirements 9.2
 */

// Capture values passed to task.create()
let capturedData: Record<string, unknown> | null = null;

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	sortOrder: number;
	createdAt: Date;
	isDailyStanding: boolean;
};

let allTasks: TaskRow[] = [];
let taskDayCompletions: Array<{
	userId: string;
	taskId: number;
	localDateKey: string;
}> = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	return {
		db: {
			task: {
				findMany: vi.fn(
					(args?: { where?: { userId?: string }; orderBy?: unknown }) => {
						let rows = [...allTasks];
						if (args?.where?.userId != null) {
							rows = rows.filter((t) => t.userId === args.where?.userId);
						}
						return Promise.resolve(rows);
					},
				),
				aggregate: vi.fn(() =>
					Promise.resolve({ _max: { sortOrder: null as number | null } }),
				),
				create: vi.fn((args: { data: Record<string, unknown> }) => {
					capturedData = args.data;
					return Promise.resolve({ id: 1, ...args.data });
				}),
				findFirst: vi.fn(
					(args?: { where?: { id?: number; userId?: string } }) => {
						return Promise.resolve(
							allTasks.find(
								(t) =>
									t.id === args?.where?.id && t.userId === args?.where?.userId,
							) ?? null,
						);
					},
				),
				update: vi.fn(() => Promise.resolve({ id: 1 })),
				delete: vi.fn(() => Promise.resolve({ id: 1 })),
			},
			taskDayCompletion: {
				findMany: vi.fn(
					(args: { where: { userId?: string; localDateKey?: string } }) => {
						return Promise.resolve(
							taskDayCompletions.filter((row) => {
								if (
									args.where.userId != null &&
									row.userId !== args.where.userId
								) {
									return false;
								}
								if (
									args.where.localDateKey != null &&
									row.localDateKey !== args.where.localDateKey
								) {
									return false;
								}
								return true;
							}),
						);
					},
				),
			},
			$transaction: vi.fn(
				async (ops: Array<Promise<unknown>> | ((tx: unknown) => unknown)) => {
					if (typeof ops === "function") {
						return ops((await import("~/server/db/index")).db);
					}
					return Promise.all(ops);
				},
			),
		},
	};
});

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(taskRouter);
const USER_ID = "task-query-user";

function taskCaller(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: "test@example.com",
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.string({ minLength: 1, maxLength: 255 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for valid task titles (1-256 chars, non-empty) */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 256 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,20}$/),
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.constantFrom("com", "org", "net", "io"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

describe("Feature: neon-auth, Property 9: Task creation ownership", () => {
	beforeEach(() => {
		capturedData = null;
		allTasks = [];
		taskDayCompletions = [];
	});

	fcTest.prop([userIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
		"created task always has userId matching the authenticated user's ID",
		async (userId, title, email) => {
			const caller = createCaller({
				db: (await import("~/server/db/index")).db as never,
				session: {
					user: {
						id: userId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			await caller.create({ title });

			expect(capturedData).not.toBeNull();
			expect(capturedData?.userId).toBe(userId);
			expect(capturedData?.title).toBe(title);
		},
	);
});

describe("task query edge branches", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		vi.clearAllMocks();
	});

	it("list with localDateKey marks standing tasks done for that date", async () => {
		allTasks = [
			{
				id: 1,
				title: "Standing",
				status: "active",
				userId: USER_ID,
				sortOrder: 0,
				createdAt: new Date(),
				isDailyStanding: true,
			},
			{
				id: 2,
				title: "Regular",
				status: "active",
				userId: USER_ID,
				sortOrder: 1,
				createdAt: new Date(),
				isDailyStanding: false,
			},
		];
		taskDayCompletions = [
			{ userId: USER_ID, taskId: 1, localDateKey: "2026-06-19" },
		];

		const list = await taskCaller().list({ localDateKey: "2026-06-19" });

		expect(db.taskDayCompletion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_ID, localDateKey: "2026-06-19" },
			}),
		);
		expect(list.find((t) => t.id === 1)?.doneForToday).toBe(true);
		expect(list.find((t) => t.id === 2)?.doneForToday).toBe(false);
	});

	it("reorder rejects when orderedIds do not match active owned set size", async () => {
		allTasks = [
			{
				id: 1,
				title: "One",
				status: "active",
				userId: USER_ID,
				sortOrder: 0,
				createdAt: new Date(),
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "Two",
				status: "active",
				userId: USER_ID,
				sortOrder: 1,
				createdAt: new Date(),
				isDailyStanding: false,
			},
		];

		await expect(
			taskCaller().reorder({ orderedIds: [1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(db.task.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_ID, status: "active" },
			}),
		);
	});
});
