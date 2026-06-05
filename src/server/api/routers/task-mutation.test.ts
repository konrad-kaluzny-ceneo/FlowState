import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure
 * Validates: Requirements 9.4, 9.5
 */

// Stateful in-memory store; findFirst filters by { id, userId } like production
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
	return {
		db: {
			task: {
				findMany: vi.fn(() => Promise.resolve([])),
				create: vi.fn((args: { data: Record<string, unknown> }) =>
					Promise.resolve({ id: 1, ...args.data }),
				),
				findFirst: vi.fn(
					(args: { where?: { id?: number; userId?: string } }) => {
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

const createCaller = createCallerFactory(taskRouter);

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.string({ minLength: 1, maxLength: 50 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for positive task IDs */
const taskIdArb = fc.integer({ min: 1, max: 100000 });

/** Arbitrary for valid task titles (1-256 chars, non-empty) */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 256 })
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
 * Arbitrary for ownership scenarios:
 * - ownerUserId: the user who owns the task
 * - callerUserId: the user attempting the mutation
 */
const ownershipScenarioArb = fc
	.tuple(userIdArb, userIdArb, fc.boolean())
	.map(([userId1, userId2, sameUser]) => {
		if (sameUser) {
			return { ownerUserId: userId1, callerUserId: userId1 };
		}
		// Ensure different users
		const callerUserId = userId1 === userId2 ? `${userId2}_other` : userId2;
		return { ownerUserId: userId1, callerUserId };
	});

describe("Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure", () => {
	beforeEach(() => {
		allTasks = [];
	});

	fcTest.prop([ownershipScenarioArb, taskIdArb, taskTitleArb, emailArb], {
		numRuns: 100,
	})(
		"update succeeds only when userId matches, returns NOT_FOUND otherwise",
		async (scenario, taskId, title, email) => {
			const isOwner = scenario.ownerUserId === scenario.callerUserId;

			// Seed task owned by ownerUserId; findFirst with caller's userId only matches when owner === caller
			allTasks = [
				{
					id: taskId,
					title: "Original",
					status: "active",
					userId: scenario.ownerUserId,
					createdAt: new Date(),
					updatedAt: null,
				},
			];

			const caller = createCaller({
				db: (await import("~/server/db/index")).db as never,
				session: {
					user: {
						id: scenario.callerUserId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			if (isOwner) {
				await expect(
					caller.update({ id: taskId, title }),
				).resolves.not.toThrow();
			} else {
				await expect(caller.update({ id: taskId, title })).rejects.toThrow(
					expect.objectContaining({
						code: "NOT_FOUND",
					}),
				);
			}
		},
	);

	fcTest.prop([ownershipScenarioArb, taskIdArb, emailArb], { numRuns: 100 })(
		"delete succeeds only when userId matches, returns NOT_FOUND otherwise",
		async (scenario, taskId, email) => {
			const isOwner = scenario.ownerUserId === scenario.callerUserId;

			allTasks = [
				{
					id: taskId,
					title: "Task",
					status: "active",
					userId: scenario.ownerUserId,
					createdAt: new Date(),
					updatedAt: null,
				},
			];

			const caller = createCaller({
				db: (await import("~/server/db/index")).db as never,
				session: {
					user: {
						id: scenario.callerUserId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			if (isOwner) {
				await expect(caller.delete({ id: taskId })).resolves.not.toThrow();
			} else {
				await expect(caller.delete({ id: taskId })).rejects.toThrow(
					expect.objectContaining({
						code: "NOT_FOUND",
					}),
				);
			}
		},
	);
});
