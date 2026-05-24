import { describe, expect } from "vitest";
import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { z } from "zod";

/**
 * Feature: neon-auth, Property 1: Environment schema validates URL format and secret length
 * Validates: Requirements 1.6, 1.7
 */

// Replicate the exact schemas from src/env.js for isolated testing
const neonAuthBaseUrlSchema = z
	.string()
	.url()
	.refine((val) => val.startsWith("https://"), {
		message: "NEON_AUTH_BASE_URL must start with https://",
	});

const neonAuthCookieSecretSchema = z.string().min(32, {
	message: "NEON_AUTH_COOKIE_SECRET must be at least 32 characters",
});

/** Printable ASCII characters for generating meaningful secrets */
const printableCharArb = fc.constantFrom(
	..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?".split(
		"",
	),
);

describe("Feature: neon-auth, Property 1: Environment schema validates URL format and secret length", () => {
	fcTest.prop([fc.webUrl({ validSchemes: ["https"] })], { numRuns: 100 })(
		"accepts any valid https:// URL for NEON_AUTH_BASE_URL",
		(url) => {
			const result = neonAuthBaseUrlSchema.safeParse(url);
			expect(result.success).toBe(true);
		},
	);

	fcTest.prop(
		[
			fc.oneof(
				fc.webUrl({ validSchemes: ["http"] }),
				fc.constant("http://example.com"),
				fc.constant("ftp://files.example.com"),
				fc.constant("http://localhost:3000"),
			),
		],
		{ numRuns: 100 },
	)("rejects URLs that do not start with https://", (url) => {
		const result = neonAuthBaseUrlSchema.safeParse(url);
		expect(result.success).toBe(false);
	});

	fcTest.prop(
		[
			fc.string({ minLength: 1, maxLength: 200 }).filter((s) => {
				try {
					new URL(s);
					return false; // valid URL — filter out
				} catch {
					return true; // invalid URL — keep
				}
			}),
		],
		{ numRuns: 100 },
	)("rejects strings that are not valid URLs", (value) => {
		const result = neonAuthBaseUrlSchema.safeParse(value);
		expect(result.success).toBe(false);
	});

	fcTest.prop(
		[fc.string({ unit: printableCharArb, minLength: 32, maxLength: 256 })],
		{ numRuns: 100 },
	)(
		"accepts any string with length >= 32 for NEON_AUTH_COOKIE_SECRET",
		(secret) => {
			const result = neonAuthCookieSecretSchema.safeParse(secret);
			expect(result.success).toBe(true);
		},
	);

	fcTest.prop(
		[fc.string({ unit: printableCharArb, minLength: 1, maxLength: 31 })],
		{ numRuns: 100 },
	)(
		"rejects any string with length < 32 for NEON_AUTH_COOKIE_SECRET",
		(secret) => {
			const result = neonAuthCookieSecretSchema.safeParse(secret);
			expect(result.success).toBe(false);
		},
	);
});
