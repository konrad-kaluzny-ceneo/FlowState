import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { TRPCError } from "@trpc/server";

/**
 * Feature: neon-auth, Property 8: protectedProcedure enforcement
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

// Mock ~/server/db before importing trpc module
vi.mock("~/server/db", () => ({
	db: {},
}));

// Mock ~/lib/auth/server with a controllable getSession
const mockGetSession = vi.fn();
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: () => mockGetSession(),
	},
}));

// Stub global setTimeout to resolve immediately (eliminates timingMiddleware dev delay)
const originalSetTimeout = globalThis.setTimeout;
// biome-ignore lint/suspicious/noExplicitAny: test utility override
globalThis.setTimeout = ((fn: () => void, _ms?: number) =>
	originalSetTimeout(fn, 0)) as any;

// Import after mocks are set up
const { createCallerFactory, createTRPCContext, createTRPCRouter, protectedProcedure } =
	await import("~/server/api/trpc");

// Create a test router with a protectedProcedure that returns the session user
const testRouter = createTRPCRouter({
	getUser: protectedProcedure.query(({ ctx }) => {
		return ctx.session.user;
	}),
});

const createCaller = createCallerFactory(testRouter);

/** Arbitrary for non-empty strings (simulating user id, email, name) */
const nonEmptyStringArb = fc
	.string({ minLength: 1, maxLength: 100 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for valid email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,20}$/),
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.constantFrom("com", "org", "net", "io"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/** Arbitrary for a valid getSession result that produces a non-null ctx.session */
const validSessionResultArb = fc
	.tuple(nonEmptyStringArb, emailArb, nonEmptyStringArb)
	.map(([id, email, name]) => ({
		data: {
			user: {
				id,
				email,
				name,
				image: null,
				emailVerified: true,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
			session: {
				id: "session-id",
				token: "token",
				expiresAt: new Date().toISOString(),
			},
		},
	}));

/**
 * Arbitrary for getSession results that produce ctx.session = null
 * (null session, missing fields, empty strings)
 */
const invalidSessionResultArb = fc.oneof(
	// null result
	fc.constant(null),
	// result with null data
	fc.constant({ data: null }),
	// result with no user
	fc.constant({ data: {} }),
	// result with user missing id
	fc.tuple(emailArb, nonEmptyStringArb).map(([email, name]) => ({
		data: { user: { id: null, email, name } },
	})),
	// result with user missing email
	fc.tuple(nonEmptyStringArb, nonEmptyStringArb).map(([id, name]) => ({
		data: { user: { id, email: null, name } },
	})),
	// result with empty string id
	fc.tuple(emailArb, nonEmptyStringArb).map(([email, name]) => ({
		data: { user: { id: "", email, name } },
	})),
	// result with empty string email
	fc.tuple(nonEmptyStringArb, nonEmptyStringArb).map(([id, name]) => ({
		data: { user: { id, email: "", name } },
	})),
	// result with undefined user
	fc.constant({ data: { user: undefined } }),
);

describe("Feature: neon-auth, Property 8: protectedProcedure enforcement", () => {
	beforeEach(() => {
		mockGetSession.mockReset();
	});

	fcTest.prop([validSessionResultArb], { numRuns: 100 })(
		"executes procedure handler when session has non-null id, email, and name",
		async (sessionResult) => {
			mockGetSession.mockImplementation(() => Promise.resolve(sessionResult));

			const caller = createCaller(
				await createTRPCContext({ headers: new Headers() }),
			);
			const user = await caller.getUser();

			expect(user).toEqual({
				id: sessionResult.data.user.id,
				email: sessionResult.data.user.email,
				name: sessionResult.data.user.name,
			});
		},
	);

	fcTest.prop([invalidSessionResultArb], { numRuns: 100 })(
		"throws UNAUTHORIZED when session is null or user properties are missing/empty",
		async (sessionResult) => {
			mockGetSession.mockResolvedValue(sessionResult);

			const caller = createCaller(
				await createTRPCContext({ headers: new Headers() }),
			);

			await expect(caller.getUser()).rejects.toThrow(TRPCError);
			await expect(caller.getUser()).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		},
	);

	fcTest.prop(
		[
			fc.constantFrom(
				"Network error",
				"Timeout",
				"Internal error",
				"ECONNREFUSED",
			),
		],
		{ numRuns: 100 },
	)(
		"throws UNAUTHORIZED when getSession() throws an error",
		async (errorMessage) => {
			mockGetSession.mockRejectedValue(new Error(errorMessage));

			const caller = createCaller(
				await createTRPCContext({ headers: new Headers() }),
			);

			await expect(caller.getUser()).rejects.toThrow(TRPCError);
			await expect(caller.getUser()).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		},
	);

	fcTest.prop([validSessionResultArb], { numRuns: 100 })(
		"provides non-nullable user properties (id, email, name) in procedure context",
		async (sessionResult) => {
			mockGetSession.mockResolvedValue(sessionResult);

			const caller = createCaller(
				await createTRPCContext({ headers: new Headers() }),
			);
			const user = await caller.getUser();

			// Verify all properties are non-null strings
			expect(typeof user.id).toBe("string");
			expect(typeof user.email).toBe("string");
			expect(typeof user.name).toBe("string");
			expect(user.id.length).toBeGreaterThan(0);
			expect(user.email.length).toBeGreaterThan(0);
			expect(user.name.length).toBeGreaterThan(0);
		},
	);
});
