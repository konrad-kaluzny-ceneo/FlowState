import { describe, expect, vi, beforeEach } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";

/**
 * Feature: neon-auth, Property 12: Error clearing on new submission
 * Validates: Requirements 10.5
 *
 * For any auth form displaying one or more error messages from a previous submission,
 * when a new form submission is initiated, all previously displayed error messages
 * SHALL be cleared before the new submission proceeds.
 */

// Mock the auth server module
vi.mock("~/lib/auth/server", () => ({
	auth: {
		signUp: {
			email: vi.fn().mockResolvedValue({ error: null }),
		},
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

describe("Feature: neon-auth, Property 12: Error clearing on new submission", () => {
	let signUpAction: typeof import("./sign-up/actions").signUpAction;
	let signInAction: typeof import("./sign-in/action").signInAction;
	let authMock: {
		signUp: { email: ReturnType<typeof vi.fn> };
		signIn: { email: ReturnType<typeof vi.fn> };
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		const signUpModule = await import("./sign-up/actions");
		signUpAction = signUpModule.signUpAction;
		const signInModule = await import("./sign-in/action");
		signInAction = signInModule.signInAction;
		const authModule = await import("~/lib/auth/server");
		authMock = authModule.auth as unknown as typeof authMock;
	});

	// --- Arbitraries ---

	/** Arbitrary for sign-up error states with at least one error */
	const signUpErrorStateArb = fc
		.record({
			name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
			email: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
			password: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
			form: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
		})
		.filter(
			(errors) =>
				errors.name !== undefined ||
				errors.email !== undefined ||
				errors.password !== undefined ||
				errors.form !== undefined,
		)
		.map((errors) => ({
			errors,
			values: { name: "Previous Name", email: "previous@example.com" },
		}));

	/** Arbitrary for sign-in error states with a non-null error */
	const signInErrorStateArb = fc
		.string({ minLength: 1, maxLength: 100 })
		.map((error) => ({
			error,
			email: "previous@example.com",
		}));

	/** Arbitrary for valid sign-up form data (passes Zod validation) */
	const validSignUpFormDataArb = fc
		.record({
			name: fc
				.string({ minLength: 1, maxLength: 50, unit: fc.constantFrom("a", "b", "c", "d", "e", "f") })
				.filter((s) => s.trim().length > 0),
			email: fc
				.tuple(
					fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom("a", "b", "c", "d", "e") }),
					fc.constantFrom("example.com", "test.org", "mail.io"),
				)
				.map(([local, domain]) => `${local}@${domain}`),
			password: fc.string({
				minLength: 8,
				maxLength: 20,
				unit: fc.constantFrom("a", "b", "c", "1", "2", "3", "!", "@"),
			}),
		})
		.map((data) => {
			const fd = new FormData();
			fd.set("name", data.name);
			fd.set("email", data.email);
			fd.set("password", data.password);
			return fd;
		});

	/** Arbitrary for valid sign-in form data (non-empty email and password) */
	const validSignInFormDataArb = fc
		.record({
			email: fc
				.tuple(
					fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom("a", "b", "c", "d", "e") }),
					fc.constantFrom("example.com", "test.org", "mail.io"),
				)
				.map(([local, domain]) => `${local}@${domain}`),
			password: fc.string({
				minLength: 8,
				maxLength: 20,
				unit: fc.constantFrom("a", "b", "c", "1", "2", "3", "!", "@"),
			}),
		})
		.map((data) => {
			const fd = new FormData();
			fd.set("email", data.email);
			fd.set("password", data.password);
			return fd;
		});

	// --- Sign-Up: Error clearing on valid submission ---

	fcTest.prop([signUpErrorStateArb, validSignUpFormDataArb], { numRuns: 100 })(
		"sign-up: previous errors are cleared when a new valid submission succeeds",
		async (prevState, formData) => {
			// Mock successful sign-up (no error from auth server)
			authMock.signUp.email.mockResolvedValue({ error: null });

			// The action will call redirect on success, which throws in the mock
			// We need to handle the redirect mock behavior
			const { redirect } = await import("next/navigation");
			(redirect as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("NEXT_REDIRECT");
			});

			let result: Awaited<ReturnType<typeof signUpAction>> | null = null;
			try {
				result = await signUpAction(prevState, formData);
			} catch (e: unknown) {
				// redirect throws - this means success (no errors returned)
				if (e instanceof Error && e.message === "NEXT_REDIRECT") {
					// Success path: redirect was called, meaning no errors were returned
					// The previous errors are effectively cleared because the action
					// never returns the old state - it either returns a new state or redirects
					return;
				}
				throw e;
			}

			// If we get here, the action returned a new state (not redirected)
			// The returned state should NOT contain any of the previous errors
			if (result) {
				// Verify old errors are not carried forward
				expect(result.errors).not.toEqual(prevState.errors);
			}
		},
	);

	fcTest.prop([signUpErrorStateArb, validSignUpFormDataArb], { numRuns: 100 })(
		"sign-up: previous errors are replaced (not accumulated) when new submission has validation errors",
		async (prevState, _validFormData) => {
			// Submit with invalid data to trigger NEW validation errors
			const invalidFormData = new FormData();
			invalidFormData.set("name", ""); // empty name triggers error
			invalidFormData.set("email", "valid@example.com");
			invalidFormData.set("password", "validpass123");

			const result = await signUpAction(prevState, invalidFormData);

			// The result should have a fresh error state based on the NEW submission
			// It should have a name error (because name is empty)
			expect(result.errors.name).toBeDefined();

			// Previous errors that are NOT triggered by the new submission should NOT appear
			// The action always returns a fresh error object from the new validation
			// If prevState had email/password/form errors, they should NOT carry over
			// unless the new submission also triggers those same errors
			if (prevState.errors.email) {
				// The new submission has a valid email, so no email error should appear
				expect(result.errors.email).toBeUndefined();
			}
			if (prevState.errors.password) {
				// The new submission has a valid password, so no password error should appear
				expect(result.errors.password).toBeUndefined();
			}
			if (prevState.errors.form) {
				// Form-level errors from previous submission should not carry over
				expect(result.errors.form).toBeUndefined();
			}
		},
	);

	// --- Sign-In: Error clearing on valid submission ---

	fcTest.prop([signInErrorStateArb, validSignInFormDataArb], { numRuns: 100 })(
		"sign-in: previous error is cleared when a new valid submission succeeds",
		async (prevState, formData) => {
			// Mock successful sign-in (no error from auth server)
			authMock.signIn.email.mockResolvedValue({ error: null });

			const { redirect } = await import("next/navigation");
			(redirect as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("NEXT_REDIRECT");
			});

			let result: Awaited<ReturnType<typeof signInAction>> | null = null;
			try {
				result = await signInAction(prevState, formData);
			} catch (e: unknown) {
				// redirect throws - success path, previous error is cleared
				if (e instanceof Error && e.message === "NEXT_REDIRECT") {
					// The action redirected, meaning it did not return the previous error state
					return;
				}
				throw e;
			}

			// If we reach here, the action returned a new state
			// The new state should NOT contain the previous error
			if (result) {
				expect(result.error).not.toBe(prevState.error);
			}
		},
	);

	fcTest.prop([signInErrorStateArb], { numRuns: 100 })(
		"sign-in: previous error is replaced with fresh state on new submission (even with new errors)",
		async (prevState) => {
			// Submit with empty fields to trigger a NEW validation error
			const invalidFormData = new FormData();
			invalidFormData.set("email", "");
			invalidFormData.set("password", "somepassword");

			const result = await signInAction(prevState, invalidFormData);

			// The result should have a NEW error (about empty email)
			expect(result.error).not.toBeNull();
			// The error should be about the current validation failure, not the old error
			expect(result.error).toContain("email");
			// The previous error message should NOT be carried forward
			expect(result.error).not.toBe(prevState.error);
		},
	);
});
