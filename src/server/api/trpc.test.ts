import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/**
 * Feature: neon-auth, Property 7: tRPC context session mapping
 * Validates: Requirements 7.1, 7.2, 7.4
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

// Import after mocks are set up
const { createTRPCContext } = await import("~/server/api/trpc");

/** Arbitrary for non-empty strings (simulating user id, email, name) */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter(
	(s) => s.trim().length > 0,
);

/** Arbitrary for valid email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,20}$/),
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.constantFrom("com", "org", "net", "io"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/** Arbitrary for a valid session result from getSession() */
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

/** Arbitrary for session results with missing/null fields */
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

/** Arbitrary for session results with missing name but valid id and email — should still produce a session */
const missingNameSessionResultArb = fc.oneof(
	// result with user missing name (null)
	fc.tuple(nonEmptyStringArb, emailArb).map(([id, email]) => ({
		data: { user: { id, email, name: null } },
	})),
	// result with empty string name
	fc.tuple(nonEmptyStringArb, emailArb).map(([id, email]) => ({
		data: { user: { id, email, name: "" } },
	})),
);

describe("Feature: neon-auth, Property 7: tRPC context session mapping", () => {
	beforeEach(() => {
		mockGetSession.mockReset();
	});

	fcTest.prop([validSessionResultArb], { numRuns: 100 })(
		"maps valid session with non-null id, email, and name to ctx.session",
		async (sessionResult) => {
			mockGetSession.mockResolvedValue(sessionResult);

			const ctx = await createTRPCContext({ headers: new Headers() });

			expect(ctx.session).not.toBeNull();
			expect(ctx.session).toEqual({
				user: {
					id: sessionResult.data.user.id,
					email: sessionResult.data.user.email,
					name: sessionResult.data.user.name,
				},
			});
		},
	);

	fcTest.prop([invalidSessionResultArb], { numRuns: 100 })(
		"maps invalid/incomplete session results to ctx.session = null",
		async (sessionResult) => {
			mockGetSession.mockResolvedValue(sessionResult);

			const ctx = await createTRPCContext({ headers: new Headers() });

			expect(ctx.session).toBeNull();
		},
	);

	fcTest.prop([missingNameSessionResultArb], { numRuns: 100 })(
		"maps session with missing name to ctx.session with email-derived name",
		async (sessionResult) => {
			mockGetSession.mockResolvedValue(sessionResult);

			const ctx = await createTRPCContext({ headers: new Headers() });

			expect(ctx.session).not.toBeNull();
			expect(ctx.session).toEqual({
				user: {
					id: sessionResult.data.user.id,
					email: sessionResult.data.user.email,
					name: sessionResult.data.user.email.split("@")[0],
				},
			});
		},
	);

	fcTest.prop(
		[fc.constantFrom("Network error", "Timeout", "Internal error", "ECONNREFUSED")],
		{ numRuns: 100 },
	)(
		"maps thrown errors from getSession() to ctx.session = null",
		async (errorMessage) => {
			mockGetSession.mockRejectedValue(new Error(errorMessage));

			const ctx = await createTRPCContext({ headers: new Headers() });

			expect(ctx.session).toBeNull();
		},
	);
});
