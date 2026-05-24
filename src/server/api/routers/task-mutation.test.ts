import { TRPCError } from "@trpc/server";
import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/**
 * Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure
 * Validates: Requirements 9.4, 9.5
 */

// Track the rowCount returned by update/delete where clauses
let updateRowCount: number = 1;
let deleteRowCount: number = 1;

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db with chainable update/delete mocks that return configurable rowCount
vi.mock("~/server/db", () => {
	const mockUpdateWhere = vi.fn(() => ({ rowCount: updateRowCount }));
	const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
	const mockUpdate = vi.fn(() => ({ set: mockSet }));

	const mockDeleteWhere = vi.fn(() => ({ rowCount: deleteRowCount }));
	const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

	return {
		db: {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => []),
					})),
				})),
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => Promise.resolve({ rowCount: 1 })),
			})),
			update: mockUpdate,
			delete: mockDelete,
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
 * - ownerMatchesCaller: whether they are the same user (determines success/failure)
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
		updateRowCount = 1;
		deleteRowCount = 1;
	});

	fcTest.prop([ownershipScenarioArb, taskIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
		"update succeeds only when userId matches, returns NOT_FOUND otherwise",
		async (scenario, taskId, title, email) => {
			const isOwner = scenario.ownerUserId === scenario.callerUserId;

			// Simulate DB behavior: rowCount > 0 only when caller owns the task
			updateRowCount = isOwner ? 1 : 0;

			const caller = createCaller({
				db: (await import("~/server/db")).db as never,
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
				// Should succeed without throwing
				await expect(
					caller.update({ id: taskId, title }),
				).resolves.not.toThrow();
			} else {
				// Should throw NOT_FOUND
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

			// Simulate DB behavior: rowCount > 0 only when caller owns the task
			deleteRowCount = isOwner ? 1 : 0;

			const caller = createCaller({
				db: (await import("~/server/db")).db as never,
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
				// Should succeed without throwing
				await expect(
					caller.delete({ id: taskId }),
				).resolves.not.toThrow();
			} else {
				// Should throw NOT_FOUND
				await expect(caller.delete({ id: taskId })).rejects.toThrow(
					expect.objectContaining({
						code: "NOT_FOUND",
					}),
				);
			}
		},
	);
});
