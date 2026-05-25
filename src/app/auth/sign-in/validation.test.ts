import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property 6: Sign-in client-side validation rejects empty fields
 * Validates: Requirements 5.6
 */

// Mock the auth server module to prevent actual auth calls
vi.mock("~/lib/auth/server", () => ({
	auth: {
		signIn: {
			email: vi.fn().mockResolvedValue({ error: null }),
		},
	},
}));

// Mock next/navigation to prevent redirect errors in tests
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

// Mock @neondatabase/auth/next/server for the NEON_AUTH_NETWORK_ERROR_CODES import
vi.mock("@neondatabase/auth/next/server", () => ({
	NEON_AUTH_NETWORK_ERROR_CODES: [
		"NETWORK_DNS",
		"NETWORK_REFUSED",
		"NETWORK_TIMEOUT",
		"NETWORK_TLS",
		"NETWORK_RESET",
	],
}));

describe("Feature: neon-auth, Property 6: Sign-in client-side validation rejects empty fields", () => {
	let signInAction: typeof import("./action").signInAction;
	let authMock: { signIn: { email: ReturnType<typeof vi.fn> } };

	beforeEach(async () => {
		vi.clearAllMocks();
		const actionModule = await import("./action");
		signInAction = actionModule.signInAction;
		const authModule = await import("~/lib/auth/server");
		authMock = authModule.auth as unknown as typeof authMock;
	});

	/** Arbitrary for non-empty strings (after trim) representing valid email input */
	const nonEmptyStringArb = fc
		.string({ minLength: 1, maxLength: 100 })
		.filter((s) => s.trim().length > 0);

	/** Arbitrary for empty-like strings (empty or whitespace-only, which trim to empty) */
	const emptyStringArb = fc.oneof(
		fc.constant(""),
		fc.string({ unit: fc.constant(" "), minLength: 1, maxLength: 10 }),
		fc.string({ unit: fc.constant("\t"), minLength: 1, maxLength: 5 }),
		fc.string({
			unit: fc.constantFrom(" ", "\t", "\n", "\r"),
			minLength: 1,
			maxLength: 10,
		}),
	);

	/** Arbitrary for non-empty password (password is not trimmed, just checked for empty) */
	const nonEmptyPasswordArb = fc.string({ minLength: 1, maxLength: 128 });

	/** Helper to create FormData from email and password */
	function makeFormData(email: string, password: string): FormData {
		const fd = new FormData();
		fd.set("email", email);
		fd.set("password", password);
		return fd;
	}

	const prevState = { error: null, email: "" };

	fcTest.prop([emptyStringArb, nonEmptyPasswordArb], { numRuns: 100 })(
		"returns error when email is empty (regardless of password)",
		async (email, password) => {
			const result = await signInAction(
				prevState,
				makeFormData(email, password),
			);
			expect(result.error).not.toBeNull();
			expect(result.error).toContain("email");
			// Should NOT call auth.signIn.email
			expect(authMock.signIn.email).not.toHaveBeenCalled();
		},
	);

	fcTest.prop([nonEmptyStringArb, fc.constant("")], { numRuns: 100 })(
		"returns error when password is empty (regardless of email)",
		async (email, _password) => {
			const result = await signInAction(prevState, makeFormData(email, ""));
			expect(result.error).not.toBeNull();
			expect(result.error).toContain("password");
			// Should NOT call auth.signIn.email
			expect(authMock.signIn.email).not.toHaveBeenCalled();
		},
	);

	fcTest.prop([emptyStringArb, fc.constant("")], { numRuns: 100 })(
		"returns error mentioning both fields when both email and password are empty",
		async (email, _password) => {
			const result = await signInAction(prevState, makeFormData(email, ""));
			expect(result.error).not.toBeNull();
			expect(result.error).toContain("email");
			expect(result.error).toContain("password");
			// Should NOT call auth.signIn.email
			expect(authMock.signIn.email).not.toHaveBeenCalled();
		},
	);

	fcTest.prop([nonEmptyStringArb, nonEmptyPasswordArb], { numRuns: 100 })(
		"does not return validation error when both email and password are non-empty",
		async (email, password) => {
			authMock.signIn.email.mockResolvedValue({ error: null });
			const result = await signInAction(
				prevState,
				makeFormData(email, password),
			);
			// When both fields are non-empty, auth.signIn.email should be called
			expect(authMock.signIn.email).toHaveBeenCalledWith({
				email: email.trim(),
				password,
			});
		},
	);
});
