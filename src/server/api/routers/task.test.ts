import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property 9: Task creation ownership
 * Validates: Requirements 9.2
 */

// Capture values passed to task.create()
let capturedData: Record<string, unknown> | null = null;

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
				create: vi.fn((args: { data: Record<string, unknown> }) => {
					capturedData = args.data;
					return Promise.resolve({ id: 1, ...args.data });
				}),
				findFirst: vi.fn(() => Promise.resolve(null)),
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
			expect(capturedData!.userId).toBe(userId);
			expect(capturedData!.title).toBe(title);
		},
	);
});
