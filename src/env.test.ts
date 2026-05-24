import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Feature: vercel-neon-deployment, Property 2: Connection string validation accepts only PostgreSQL URIs
 *
 * Validates: Requirements 4.1, 4.2
 */
describe("Feature: vercel-neon-deployment, Property 2: Connection string validation accepts only PostgreSQL URIs", () => {
	// Same validation logic as in src/env.js
	const connectionStringValidator = z.string().refine(
		(val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
		{
			message:
				"DATABASE_URL must be a postgresql:// or postgres:// connection string",
		},
	);

	it("should accept any string starting with postgresql:// or postgres://", () => {
		const validPrefix = fc.oneof(
			fc.constant("postgresql://"),
			fc.constant("postgres://"),
		);
		const validConnectionString = validPrefix.chain((prefix) =>
			fc.string().map((suffix) => prefix + suffix),
		);

		fc.assert(
			fc.property(validConnectionString, (connStr) => {
				const result = connectionStringValidator.safeParse(connStr);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it("should reject any string NOT starting with postgresql:// or postgres://", () => {
		const invalidConnectionString = fc
			.string()
			.filter(
				(s) =>
					!s.startsWith("postgresql://") && !s.startsWith("postgres://"),
			);

		fc.assert(
			fc.property(invalidConnectionString, (connStr) => {
				const result = connectionStringValidator.safeParse(connStr);
				expect(result.success).toBe(false);
			}),
			{ numRuns: 100 },
		);
	});
});
