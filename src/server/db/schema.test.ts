import { getTableName } from "drizzle-orm";
import { pgTableCreator } from "drizzle-orm/pg-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

/**
 * Feature: vercel-neon-deployment, Property 1: Table name prefix preservation
 *
 * Validates: Requirements 1.2
 */
describe("Feature: vercel-neon-deployment, Property 1: Table name prefix preservation", () => {
	const PREFIX = ".bootstrap-scaffold_";

	// Create a pgTableCreator instance with the same prefix function used in production
	const createTable = pgTableCreator((name) => `${PREFIX}${name}`);

	// Generator for valid SQL identifier strings:
	// - At least 1 character
	// - Only letters (a-z, A-Z), digits (0-9), and underscores
	const validSqlIdentifier = fc
		.string({
			minLength: 1,
			unit: fc.constantFrom(
				..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_".split(
					"",
				),
			),
		})
		.filter((s) => s.length > 0);

	it("should prefix any valid table name with .bootstrap-scaffold_", () => {
		fc.assert(
			fc.property(validSqlIdentifier, (tableName) => {
				const table = createTable(tableName, (d) => ({}));
				const resolvedName = getTableName(table);

				expect(resolvedName).toBe(`${PREFIX}${tableName}`);
			}),
			{ numRuns: 100 },
		);
	});
});
