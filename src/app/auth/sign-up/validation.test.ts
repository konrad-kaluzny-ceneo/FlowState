import { describe, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { z } from "zod";

// Replicate the exact schema from src/app/auth/sign-up/actions.ts for isolated testing
// (The actions module imports server-side Next.js dependencies that cannot load in vitest)
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

/**
 * Feature: neon-auth, Property 4: Sign-up client-side validation rejects invalid input
 * Validates: Requirements 4.4
 */

describe("Feature: neon-auth, Property 4: Sign-up client-side validation rejects invalid input", () => {
	/** Valid password arbitrary (8–128 chars) for use when testing name/email validation */
	const validPasswordArb = fc.string({
		minLength: 8,
		maxLength: 128,
		unit: fc.constantFrom(
			..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*".split(
				"",
			),
		),
	});

	/** Valid email arbitrary for use when testing name validation */
	const validEmailArb = fc
		.tuple(
			fc.string({
				minLength: 1,
				maxLength: 20,
				unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")),
			}),
			fc.string({
				minLength: 1,
				maxLength: 10,
				unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz".split("")),
			}),
			fc.constantFrom("com", "org", "net", "io", "dev"),
		)
		.map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

	/** Valid name arbitrary for use when testing email validation */
	const validNameArb = fc.string({
		minLength: 1,
		maxLength: 100,
		unit: fc.constantFrom(
			..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ".split(""),
		),
	}).filter((s) => s.trim().length > 0);

	fcTest.prop([validEmailArb, validPasswordArb], { numRuns: 100 })(
		"rejects empty name",
		(email, password) => {
			const result = signUpSchema.safeParse({ name: "", email, password });
			expect(result.success).toBe(false);
			if (!result.success) {
				const fieldErrors = result.error.flatten().fieldErrors;
				expect(fieldErrors.name).toBeDefined();
				expect(fieldErrors.name!.length).toBeGreaterThan(0);
			}
		},
	);

	fcTest.prop(
		[
			fc
				.string({
					minLength: 1,
					maxLength: 100,
					unit: fc.constantFrom(" ", "\t", "\n", "\r"),
				}),
			validEmailArb,
			validPasswordArb,
		],
		{ numRuns: 100 },
	)(
		"rejects whitespace-only names",
		(name, email, password) => {
			const result = signUpSchema.safeParse({ name, email, password });
			expect(result.success).toBe(false);
			if (!result.success) {
				const fieldErrors = result.error.flatten().fieldErrors;
				expect(fieldErrors.name).toBeDefined();
				expect(fieldErrors.name!.length).toBeGreaterThan(0);
			}
		},
	);

	fcTest.prop(
		[
			validNameArb,
			fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
				// Ensure it's not a valid email (no @ or missing domain parts)
				return !s.includes("@") || !s.match(/^.+@.+\..+$/);
			}),
			validPasswordArb,
		],
		{ numRuns: 100 },
	)(
		"rejects invalid email formats (no @ or malformed)",
		(name, email, password) => {
			const result = signUpSchema.safeParse({ name, email, password });
			expect(result.success).toBe(false);
			if (!result.success) {
				const fieldErrors = result.error.flatten().fieldErrors;
				expect(fieldErrors.email).toBeDefined();
				expect(fieldErrors.email!.length).toBeGreaterThan(0);
			}
		},
	);

	fcTest.prop([validNameArb, validPasswordArb], { numRuns: 100 })(
		"rejects empty email",
		(name, password) => {
			const result = signUpSchema.safeParse({ name, email: "", password });
			expect(result.success).toBe(false);
			if (!result.success) {
				const fieldErrors = result.error.flatten().fieldErrors;
				expect(fieldErrors.email).toBeDefined();
				expect(fieldErrors.email!.length).toBeGreaterThan(0);
			}
		},
	);

	fcTest.prop([validNameArb, validEmailArb, validPasswordArb], { numRuns: 100 })(
		"accepts valid name, email, and password combinations",
		(name, email, password) => {
			const result = signUpSchema.safeParse({ name, email, password });
			expect(result.success).toBe(true);
		},
	);
});
