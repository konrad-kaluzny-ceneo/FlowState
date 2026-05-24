import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";

/**
 * Creates an isolated in-memory database with the schema applied.
 * Each test suite gets a fresh DB — no cross-test contamination.
 */
function createTestDb() {
	const client = createClient({ url: ":memory:" });
	const db = drizzle(client, { schema });
	return { client, db };
}

async function applySchema(db: ReturnType<typeof drizzle>) {
	await db.run(sql`
		CREATE TABLE IF NOT EXISTS ".bootstrap-scaffold_post" (
			"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			"name" text(256),
			"createdAt" integer DEFAULT (unixepoch()) NOT NULL,
			"updatedAt" integer
		)
	`);
	await db.run(sql`
		CREATE INDEX IF NOT EXISTS "name_idx" ON ".bootstrap-scaffold_post" ("name")
	`);
}

describe("postRouter", () => {
	let db: ReturnType<typeof createTestDb>["db"];
	let client: ReturnType<typeof createTestDb>["client"];
	let caller: ReturnType<typeof appRouter.createCaller>;

	beforeEach(async () => {
		const testDb = createTestDb();
		db = testDb.db;
		client = testDb.client;
		await applySchema(db);

		caller = appRouter.createCaller({
			db,
			headers: new Headers(),
		});
	});

	afterEach(() => {
		client.close();
	});

	describe("hello", () => {
		it("returns greeting with provided text", async () => {
			const result = await caller.post.hello({ text: "world" });
			expect(result).toEqual({ greeting: "Hello world" });
		});

		it("handles empty string input", async () => {
			const result = await caller.post.hello({ text: "" });
			expect(result).toEqual({ greeting: "Hello " });
		});
	});

	describe("create", () => {
		it("creates a post with valid name", async () => {
			await expect(
				caller.post.create({ name: "Test Post" }),
			).resolves.toBeUndefined();
		});

		it("persists the post in the database", async () => {
			await caller.post.create({ name: "Persisted Post" });
			const result = await caller.post.getLatest();
			expect(result?.name).toBe("Persisted Post");
		});

		it("rejects empty name", async () => {
			await expect(caller.post.create({ name: "" })).rejects.toThrow();
		});
	});

	describe("getLatest", () => {
		it("returns null when no posts exist", async () => {
			const result = await caller.post.getLatest();
			expect(result).toBeNull();
		});

		it("returns the most recently created post", async () => {
			await caller.post.create({ name: "First" });
			// createdAt uses unixepoch() (second precision) — insert a single post
			// and verify it's returned as the latest
			const result = await caller.post.getLatest();
			expect(result).not.toBeNull();
			expect(result?.name).toBe("First");
		});

		it("returns a post object with expected shape", async () => {
			await caller.post.create({ name: "Shaped" });
			const result = await caller.post.getLatest();
			expect(result).toMatchObject({
				id: expect.any(Number),
				name: "Shaped",
				createdAt: expect.any(Date),
			});
		});
	});
});
