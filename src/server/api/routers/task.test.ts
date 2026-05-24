import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/**
 * Feature: neon-auth, Property 9: Task creation ownership
 * Validates: Requirements 9.2
 */

// Capture values passed to insert().values()
let capturedValues: Record<string, unknown> | null = null;

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db with a chainable insert mock that captures values
vi.mock("~/server/db", () => {
	const mockValues = vi.fn((vals: Record<string, unknown>) => {
		capturedValues = vals;
		return Promise.resolve({ rowCount: 1 });
	});
	const mockInsert = vi.fn(() => ({
		values: mockValues,
	}));
	return {
		db: {
			insert: mockInsert,
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => []),
					})),
				})),
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ rowCount: 1 })),
				})),
			})),
			delete: vi.fn(() => ({
				where: vi.fn(() => ({ rowCount: 1 })),
			})),
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
		capturedValues = null;
	});

	fcTest.prop([userIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
		"created task always has userId matching the authenticated user's ID",
		async (userId, title, email) => {
			const caller = createCaller({
				db: (await import("~/server/db")).db as never,
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

			expect(capturedValues).not.toBeNull();
			expect(capturedValues!.userId).toBe(userId);
			expect(capturedValues!.title).toBe(title);
		},
	);
});
