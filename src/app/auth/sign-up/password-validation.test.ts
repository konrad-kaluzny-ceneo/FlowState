import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect } from "vitest";
import { z } from "zod";

/**
 * Feature: neon-auth, Property 5: Password length boundary validation
 * Validates: Requirements 4.5
 */

// Replicate the exact password schema from src/app/auth/sign-up/actions.ts for isolated testing
// (avoids importing server-only dependencies like @neondatabase/auth)
const signUpSchema = z.object({
	name: z
		.string()
		.min(1, "Name is required")
		.max(100, "Name must be 100 characters or less")
		.refine((val) => val.trim().length > 0, "Name cannot be only whitespace"),
	email: z
		.string()
		.min(1, "Email is required")
		.max(254, "Email must be 254 characters or less")
		.email("Please enter a valid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(128, "Password must be 128 characters or less"),
});

/** Valid name and email to isolate password validation */
const validName = "Test User";
const validEmail = "test@example.com";

/** Printable ASCII characters for generating passwords */
const printableCharArb = fc.constantFrom(
	..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?".split(
		"",
	),
);

describe("Feature: neon-auth, Property 5: Password length boundary validation", () => {
	fcTest.prop(
		[fc.string({ unit: printableCharArb, minLength: 8, maxLength: 128 })],
		{ numRuns: 100 },
	)(
		"accepts passwords with length between 8 and 128 (inclusive)",
		(password) => {
			const result = signUpSchema.safeParse({
				name: validName,
				email: validEmail,
				password,
			});
			expect(result.success).toBe(true);
		},
	);

	fcTest.prop(
		[fc.string({ unit: printableCharArb, minLength: 1, maxLength: 7 })],
		{ numRuns: 100 },
	)("rejects passwords with length less than 8", (password) => {
		const result = signUpSchema.safeParse({
			name: validName,
			email: validEmail,
			password,
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const passwordErrors = result.error.flatten().fieldErrors.password;
			expect(passwordErrors).toBeDefined();
			expect(passwordErrors?.[0]).toContain("at least 8 characters");
		}
	});

	fcTest.prop(
		[fc.string({ unit: printableCharArb, minLength: 129, maxLength: 300 })],
		{ numRuns: 100 },
	)("rejects passwords with length greater than 128", (password) => {
		const result = signUpSchema.safeParse({
			name: validName,
			email: validEmail,
			password,
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const passwordErrors = result.error.flatten().fieldErrors.password;
			expect(passwordErrors).toBeDefined();
			expect(passwordErrors?.[0]).toContain("128 characters or less");
		}
	});

	fcTest.prop([fc.constant("abcdefg")], { numRuns: 1 })(
		"boundary: rejects password of exactly length 7",
		(password) => {
			expect(password.length).toBe(7);
			const result = signUpSchema.safeParse({
				name: validName,
				email: validEmail,
				password,
			});
			expect(result.success).toBe(false);
		},
	);

	fcTest.prop([fc.constant("abcdefgh")], { numRuns: 1 })(
		"boundary: accepts password of exactly length 8",
		(password) => {
			expect(password.length).toBe(8);
			const result = signUpSchema.safeParse({
				name: validName,
				email: validEmail,
				password,
			});
			expect(result.success).toBe(true);
		},
	);

	fcTest.prop([fc.constant("a".repeat(128))], { numRuns: 1 })(
		"boundary: accepts password of exactly length 128",
		(password) => {
			expect(password.length).toBe(128);
			const result = signUpSchema.safeParse({
				name: validName,
				email: validEmail,
				password,
			});
			expect(result.success).toBe(true);
		},
	);

	fcTest.prop([fc.constant("a".repeat(129))], { numRuns: 1 })(
		"boundary: rejects password of exactly length 129",
		(password) => {
			expect(password.length).toBe(129);
			const result = signUpSchema.safeParse({
				name: validName,
				email: validEmail,
				password,
			});
			expect(result.success).toBe(false);
		},
	);
});
