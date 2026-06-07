import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: neon-auth, Property: Forgot-password validation rejects empty/invalid email
 * Validates: Requirements FR-003a (S-07)
 */

vi.mock("~/lib/auth/server", () => ({
	auth: {
		requestPasswordReset: vi.fn().mockResolvedValue({ error: null }),
	},
}));

vi.mock("~/lib/auth/request-origin", () => ({
	getRequestOrigin: vi.fn().mockResolvedValue("http://localhost:3001"),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
	NEON_AUTH_NETWORK_ERROR_CODES: [
		"NETWORK_DNS",
		"NETWORK_REFUSED",
		"NETWORK_TIMEOUT",
		"NETWORK_TLS",
		"NETWORK_RESET",
	],
}));

describe("Feature: neon-auth, Forgot-password validation rejects empty/invalid email", () => {
	let forgotPasswordAction: typeof import("./action").forgotPasswordAction;
	let authMock: {
		requestPasswordReset: ReturnType<typeof vi.fn>;
	};

	const prevState = { email: "" };

	/** Valid email arbitrary */
	const validEmailArb = fc
		.tuple(
			fc.string({
				minLength: 1,
				maxLength: 20,
				unit: fc.constantFrom(
					..."abcdefghijklmnopqrstuvwxyz0123456789".split(""),
				),
			}),
			fc.string({
				minLength: 1,
				maxLength: 10,
				unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")),
			}),
			fc.constantFrom("com", "org", "net", "io", "dev"),
		)
		.map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

	/** Empty-like strings (empty or whitespace-only after trim) */
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

	function makeFormData(email: string): FormData {
		const fd = new FormData();
		fd.set("email", email);
		return fd;
	}

	beforeEach(async () => {
		vi.clearAllMocks();
		const actionModule = await import("./action");
		forgotPasswordAction = actionModule.forgotPasswordAction;
		const authModule = await import("~/lib/auth/server");
		authMock = authModule.auth as unknown as typeof authMock;
	});

	fcTest.prop([emptyStringArb], { numRuns: 100 })(
		"returns error when email is empty or whitespace-only",
		async (email) => {
			const result = await forgotPasswordAction(prevState, makeFormData(email));
			expect(result.error).toBeDefined();
			expect(result.success).toBeUndefined();
			expect(authMock.requestPasswordReset).not.toHaveBeenCalled();
		},
	);

	fcTest.prop(
		[
			fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
				return !s.includes("@") || !s.match(/^.+@.+\..+$/);
			}),
		],
		{ numRuns: 100 },
	)(
		"returns error for invalid email format without calling SDK",
		async (email) => {
			const result = await forgotPasswordAction(prevState, makeFormData(email));
			expect(result.error).toBeDefined();
			expect(result.success).toBeUndefined();
			expect(authMock.requestPasswordReset).not.toHaveBeenCalled();
		},
	);

	fcTest.prop([validEmailArb], { numRuns: 100 })(
		"calls requestPasswordReset with trimmed email and reset-password redirectTo",
		async (email) => {
			authMock.requestPasswordReset.mockResolvedValue({ error: null });
			const paddedEmail = `  ${email}  `;
			const result = await forgotPasswordAction(
				prevState,
				makeFormData(paddedEmail),
			);

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
			expect(authMock.requestPasswordReset).toHaveBeenCalledWith({
				email: email.trim(),
				redirectTo: "http://localhost:3001/auth/reset-password",
			});
		},
	);
});
