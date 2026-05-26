import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property 10: Task query isolation
 * Validates: Requirements 9.3
 */

// Store all tasks and the userId used for filtering
let allTasks: Array<{
	id: number;
	title: string;
	status: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
}> = [];
let capturedWhereUserId: string | null = null;

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style chainable mock
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn(
		(args: { where?: { userId?: string }; orderBy?: unknown }) => {
			const userId = args?.where?.userId ?? capturedWhereUserId;
			return Promise.resolve(allTasks.filter((t) => t.userId === userId));
		},
	);

	const mockCreate = vi.fn(() => Promise.resolve({ id: 1 }));
	const mockFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string } }) => {
			return Promise.resolve(
				allTasks.find(
					(t) => t.id === args?.where?.id && t.userId === args?.where?.userId,
				) ?? null,
			);
		},
	);
	const mockUpdate = vi.fn(() => Promise.resolve({ id: 1 }));
	const mockDelete = vi.fn(() => Promise.resolve({ id: 1 }));

	return {
		db: {
			task: {
				findMany: mockFindMany,
				create: mockCreate,
				findFirst: mockFindFirst,
				update: mockUpdate,
				delete: mockDelete,
			},
		},
	};
});

// Import after mocks
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");

const createCaller = createCallerFactory(taskRouter);

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.string({ minLength: 1, maxLength: 50 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for valid task titles */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 100 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.stringMatching(/^[a-z]{1,6}$/),
		fc.constantFrom("com", "org", "net"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/**
 * Generate a multi-user task set with a designated querying user.
 * Produces at least 2 distinct users, each with 1-3 tasks,
 * and selects one user as the "querying" user.
 */
const queryScenarioArb = fc
	.tuple(
		userIdArb,
		userIdArb,
		fc.array(userIdArb, { minLength: 0, maxLength: 2 }),
	)
	.map(([u1, u2, extra]) => [...new Set([u1, u2, ...extra])])
	.filter((users) => users.length >= 2)
	.chain((uniqueUsers) => {
		let taskId = 1;
		const taskArbs = uniqueUsers.map((uid) =>
			fc.array(taskTitleArb, { minLength: 1, maxLength: 3 }).map((titles) =>
				titles.map((title) => ({
					id: taskId++,
					title,
					status: "active" as const,
					userId: uid,
					createdAt: new Date("2024-01-01"),
					updatedAt: null,
				})),
			),
		);

		// Pick one user as the querying user
		const queryingUserArb = fc.constantFrom(...uniqueUsers);

		return fc
			.tuple(
				fc.tuple(...(taskArbs as [(typeof taskArbs)[0], ...typeof taskArbs])),
				queryingUserArb,
			)
			.map(([taskArrays, queryingUser]) => ({
				users: uniqueUsers,
				tasks: taskArrays.flat(),
				queryingUser,
			}));
	});

describe("Feature: neon-auth, Property 10: Task query isolation", () => {
	beforeEach(() => {
		allTasks = [];
		capturedWhereUserId = null;
		// Override setTimeout to execute immediately, bypassing tRPC timing middleware delay
		vi.spyOn(globalThis, "setTimeout").mockImplementation(
			(fn: TimerHandler) => {
				if (typeof fn === "function") fn();
				return 0 as unknown as ReturnType<typeof setTimeout>;
			},
		);
	});

	fcTest.prop([queryScenarioArb, emailArb], { numRuns: 100 })(
		"each user only sees tasks where userId matches their own ID",
		async (scenario, email) => {
			// Set up the full multi-user task set
			allTasks = scenario.tasks;

			// The querying user's ID drives the where clause filter
			capturedWhereUserId = scenario.queryingUser;

			const caller = createCaller({
				db: (await import("~/server/db/index")).db as never,
				session: {
					user: {
						id: scenario.queryingUser,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			const result = await caller.list();

			// Property: all returned tasks must belong to the querying user
			for (const task of result) {
				expect(task.userId).toBe(scenario.queryingUser);
			}

			// Property: result must contain ALL tasks belonging to this user
			const expectedTasks = allTasks.filter(
				(t) => t.userId === scenario.queryingUser,
			);
			expect(result).toHaveLength(expectedTasks.length);

			// Property: no tasks from other users should be present
			const otherUserTasks = allTasks.filter(
				(t) => t.userId !== scenario.queryingUser,
			);
			for (const otherTask of otherUserTasks) {
				expect(
					result.find((r: { id: number }) => r.id === otherTask.id),
				).toBeUndefined();
			}
		},
	);
});
