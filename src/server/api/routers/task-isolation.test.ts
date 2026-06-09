import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: neon-auth, Property 10: Task query isolation
 * Validates: Requirements 9.3
 */

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date | null;
};

// Store all tasks in an in-memory array; the mock db will filter them
let allTasks: TaskRow[] = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

function filterTasks(args: {
	where?: {
		userId?: string;
		status?: string;
		id?: number;
	};
	select?: { id?: true };
	orderBy?: Array<{ sortOrder?: "asc" | "desc"; createdAt?: "asc" | "desc" }>;
}): TaskRow[] | Array<{ id: number }> {
	let rows = [...allTasks];

	if (args.where?.userId != null) {
		rows = rows.filter((t) => t.userId === args.where?.userId);
	}
	if (args.where?.status != null) {
		rows = rows.filter((t) => t.status === args.where?.status);
	}
	if (args.where?.id != null) {
		rows = rows.filter((t) => t.id === args.where?.id);
	}

	if (args.orderBy) {
		for (const clause of [...args.orderBy].reverse()) {
			if (clause.sortOrder != null) {
				const dir = clause.sortOrder === "asc" ? 1 : -1;
				rows.sort((a, b) => (a.sortOrder - b.sortOrder) * dir);
			}
			if (clause.createdAt != null) {
				const dir = clause.createdAt === "asc" ? 1 : -1;
				rows.sort(
					(a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * dir,
				);
			}
		}
	}

	if (args.select?.id) {
		return rows.map((t) => ({ id: t.id }));
	}

	return rows;
}

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn((args: Parameters<typeof filterTasks>[0]) =>
		Promise.resolve(filterTasks(args)),
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
	const mockUpdate = vi.fn(
		(args: {
			where: { id: number };
			data: Partial<Pick<TaskRow, "sortOrder" | "status">>;
		}) => {
			const task = allTasks.find((t) => t.id === args.where.id);
			if (!task) {
				throw new Error("not found");
			}
			Object.assign(task, args.data);
			return Promise.resolve(task);
		},
	);
	const mockDelete = vi.fn(() => Promise.resolve({ id: 1 }));
	const mockAggregate = vi.fn(
		(args: {
			where?: { userId?: string; status?: string };
			_max?: { sortOrder?: true };
		}) => {
			const rows = filterTasks({ where: args.where }) as TaskRow[];
			const maxSortOrder =
				rows.length === 0 ? null : Math.max(...rows.map((t) => t.sortOrder));
			return Promise.resolve({ _max: { sortOrder: maxSortOrder } });
		},
	);

	return {
		db: {
			task: {
				findMany: mockFindMany,
				create: mockCreate,
				findFirst: mockFindFirst,
				update: mockUpdate,
				delete: mockDelete,
				aggregate: mockAggregate,
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

import { atModOrThrow, atOrThrow } from "~/test-utils/array-access";
import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(taskRouter);

const USER_A = "user-a";
const USER_B = "user-b";

function taskCaller(userId: string) {
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

/** Arbitrary for non-empty user IDs (alphanumeric to avoid edge cases with special chars) */
const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: neon-auth, Property 10: Task query isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	fcTest.prop(
		[
			// Generate 2-5 distinct user IDs
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			// A seed to pick which user is the "querying" user
			fc.nat(),
		],
		{ numRuns: 100 },
	)(
		"each user only sees their own tasks when querying",
		async (userIds, querierSeed) => {
			// Pick the querying user
			const querierIdx = querierSeed % userIds.length;
			const querierId = atOrThrow(userIds, querierIdx);

			// Generate between 5 and 20 tasks distributed across all users
			const taskCount = 5 + (querierSeed % 16);
			const generatedTasks = [];
			for (let i = 0; i < taskCount; i++) {
				const userId = atModOrThrow(userIds, i);
				generatedTasks.push({
					id: i + 1,
					title: `Task ${i}`,
					status: i % 3 === 0 ? "completed" : "active",
					userId,
					sortOrder: i,
					createdAt: new Date(2024, 0, i + 1),
					updatedAt: null,
				});
			}

			allTasks = generatedTasks;

			// Expected: only tasks belonging to the querying user
			const expectedTasks = allTasks.filter((t) => t.userId === querierId);

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: querierId,
						email: "test@example.com",
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			const result = await caller.list();

			// Property: result contains ONLY tasks belonging to the querying user
			for (const task of result) {
				expect(task.userId).toBe(querierId);
			}

			// Property: result contains ALL tasks belonging to the querying user
			expect(result).toHaveLength(expectedTasks.length);
		},
	);

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 100 },
	)("a user with no tasks gets an empty result", async (userIds, seed) => {
		// Assign all tasks to users OTHER than the querying user
		const querierId = atOrThrow(userIds, 0);
		const otherUserIds = userIds.slice(1);

		const taskCount = 3 + (seed % 10);
		allTasks = [];
		for (let i = 0; i < taskCount; i++) {
			const ownerId = atModOrThrow(otherUserIds, i);
			allTasks.push({
				id: i + 1,
				title: `Task ${i}`,
				status: "active",
				userId: ownerId,
				sortOrder: i,
				createdAt: new Date(2024, 0, i + 1),
				updatedAt: null,
			});
		}

		const caller = createCaller({
			db: db as never,
			session: {
				user: {
					id: querierId,
					email: "test@example.com",
					name: "Test User",
				},
			},
			headers: new Headers(),
		});

		const result = await caller.list();

		// Property: empty array when user owns no tasks
		expect(result).toHaveLength(0);
	});
});

describe("task reorder isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	it("user B sortOrder values unchanged after user A reorders", async () => {
		allTasks = [
			{
				id: 1,
				title: "A1",
				status: "active",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
				updatedAt: null,
			},
			{
				id: 2,
				title: "A2",
				status: "active",
				userId: USER_A,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 2),
				updatedAt: null,
			},
			{
				id: 10,
				title: "B1",
				status: "active",
				userId: USER_B,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 10),
				updatedAt: null,
			},
			{
				id: 11,
				title: "B2",
				status: "active",
				userId: USER_B,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 11),
				updatedAt: null,
			},
		];

		const bBefore = allTasks
			.filter((t) => t.userId === USER_B)
			.map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

		await taskCaller(USER_A).reorder({ orderedIds: [2, 1] });

		const bAfter = allTasks
			.filter((t) => t.userId === USER_B)
			.map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

		expect(bAfter).toEqual(bBefore);

		const aList = await taskCaller(USER_A).list();
		expect(aList.map((t) => t.id)).toEqual([2, 1]);
	});
});
