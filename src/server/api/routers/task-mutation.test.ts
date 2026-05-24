import { TRPCError } from "@trpc/server";
import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/**
 * Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure
 * Validates: Requirements 9.4, 9.5
 */

// Use vi.hoisted so the variable is accessible inside vi.mock factories
const mockState = vi.hoisted(() => ({ rowCount: 1 }));

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db with chainable update/delete mocks that dynamically read mockState.rowCount
vi.mock("~/server/db", () => {
	return {
		db: {
			insert: vi.fn(() => ({
				values: vi.fn(() => Promise.resolve({ rowCount: 1 })),
			})),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => []),
					})),
				})),
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ rowCount: mockState.rowCount })),
				})),
			})),
			delete: vi.fn(() => ({
				where: vi.fn(() => ({ rowCount: mockState.rowCount })),
			})),
		},
	};
});

// Import after mocks
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db");

const createCaller = createCallerFactory(taskRouter);

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.string({ minLength: 1, maxLength: 255 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for valid task IDs (positive integers) */
const taskIdArb = fc.integer({ min: 1, max: 2_147_483_647 });

/** Arbitrary for email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,20}$/),
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.constantFrom("com", "org", "net", "io"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/** Arbitrary for valid task titles (1-256 chars, non-empty) */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 256 })
	.filter((s) => s.trim().length > 0);

function makeCaller(userId: string, email: string) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email,
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

describe("Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure", () => {
	beforeEach(() => {
		mockState.rowCount = 1;
	});

	describe("update procedure", () => {
		fcTest.prop([userIdArb, taskIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
			"succeeds when user owns the task (rowCount > 0)",
			async (userId, taskId, title, email) => {
				mockState.rowCount = 1;
				const caller = makeCaller(userId, email);

				await expect(
					caller.update({ id: taskId, title }),
				).resolves.not.toThrow();
			},
			60_000,
		);

		fcTest.prop([userIdArb, taskIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
			"throws NOT_FOUND when user does not own the task (rowCount === 0)",
			async (userId, taskId, title, email) => {
				mockState.rowCount = 0;
				const caller = makeCaller(userId, email);

				try {
					await caller.update({ id: taskId, title });
					expect.fail("Expected TRPCError to be thrown");
				} catch (error) {
					expect(error).toBeInstanceOf(TRPCError);
					expect((error as TRPCError).code).toBe("NOT_FOUND");
				}
			},
			60_000,
		);
	});

	describe("delete procedure", () => {
		fcTest.prop([userIdArb, taskIdArb, emailArb], { numRuns: 100 })(
			"succeeds when user owns the task (rowCount > 0)",
			async (userId, taskId, email) => {
				mockState.rowCount = 1;
				const caller = makeCaller(userId, email);

				await expect(
					caller.delete({ id: taskId }),
				).resolves.not.toThrow();
			},
			60_000,
		);

		fcTest.prop([userIdArb, taskIdArb, emailArb], { numRuns: 100 })(
			"throws NOT_FOUND when user does not own the task (rowCount === 0)",
			async (userId, taskId, email) => {
				mockState.rowCount = 0;
				const caller = makeCaller(userId, email);

				try {
					await caller.delete({ id: taskId });
					expect.fail("Expected TRPCError to be thrown");
				} catch (error) {
					expect(error).toBeInstanceOf(TRPCError);
					expect((error as TRPCError).code).toBe("NOT_FOUND");
				}
			},
			60_000,
		);
	});
});
