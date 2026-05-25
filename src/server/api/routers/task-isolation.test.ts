import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property 10: Task query isolation
 * Validates: Requirements 9.3
 */

// Store all tasks in an in-memory array; the mock db will filter them
let allTasks: Array<{
	id: number;
	title: string;
	status: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
}> = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn(
		(args: { where?: { userId?: string }; orderBy?: unknown }) => {
			const userId = args?.where?.userId;
			return Promise.resolve(
				userId ? allTasks.filter((t) => t.userId === userId) : allTasks,
			);
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

// Stub global setTimeout to resolve immediately (eliminates timingMiddleware dev delay)
const originalSetTimeout = globalThis.setTimeout;
// biome-ignore lint/suspicious/noExplicitAny: test utility override
globalThis.setTimeout = ((fn: () => void, _ms?: number) =>
	originalSetTimeout(fn, 0)) as any;

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(taskRouter);

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
			const querierId = userIds[querierIdx]!;

			// Generate between 5 and 20 tasks distributed across all users
			const taskCount = 5 + (querierSeed % 16);
			const generatedTasks = [];
			for (let i = 0; i < taskCount; i++) {
				const userId = userIds[i % userIds.length]!;
				generatedTasks.push({
					id: i + 1,
					title: `Task ${i}`,
					status: i % 3 === 0 ? "completed" : "active",
					userId,
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
		const querierId = userIds[0]!;
		const otherUserIds = userIds.slice(1);

		const taskCount = 3 + (seed % 10);
		allTasks = [];
		for (let i = 0; i < taskCount; i++) {
			const ownerId = otherUserIds[i % otherUserIds.length]!;
			allTasks.push({
				id: i + 1,
				title: `Task ${i}`,
				status: "active",
				userId: ownerId,
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
