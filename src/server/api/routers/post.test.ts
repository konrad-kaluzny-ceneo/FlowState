import { describe, expect, it, vi } from "vitest";
import { appRouter } from "~/server/api/root";
import * as schema from "~/server/db/schema";

/**
 * Unit tests for the post router.
 *
 * The `hello` procedure is pure (no DB) and tested directly.
 * The `create` and `getLatest` procedures depend on a live PostgreSQL
 * database (Neon). We mock the db layer to verify procedure logic
 * without requiring a running database instance.
 */

function createMockDb() {
	const store: Array<{
		id: number;
		name: string;
		createdAt: Date;
		updatedAt: Date | null;
	}> = [];
	let nextId = 1;

	return {
		store,
		insert: vi.fn().mockImplementation((_table: unknown) => ({
			values: vi.fn().mockImplementation((row: { name: string }) => {
				store.push({
					id: nextId++,
					name: row.name,
					createdAt: new Date(),
					updatedAt: null,
				});
				return Promise.resolve();
			}),
		})),
		query: {
			posts: {
				findFirst: vi.fn().mockImplementation(
					(opts?: {
						orderBy?: (
							posts: typeof schema.posts,
							ops: { desc: (col: unknown) => unknown },
						) => unknown[];
					}) => {
						if (store.length === 0) return Promise.resolve(undefined);
						// Return the last inserted post (simulates ORDER BY createdAt DESC)
						return Promise.resolve(store[store.length - 1]);
					},
				),
			},
		},
	};
}

describe("postRouter", () => {
	describe("hello", () => {
		it("returns greeting with provided text", async () => {
			const caller = appRouter.createCaller({
				db: createMockDb() as any,
				headers: new Headers(),
			});
			const result = await caller.post.hello({ text: "world" });
			expect(result).toEqual({ greeting: "Hello world" });
		});

		it("handles empty string input", async () => {
			const caller = appRouter.createCaller({
				db: createMockDb() as any,
				headers: new Headers(),
			});
			const result = await caller.post.hello({ text: "" });
			expect(result).toEqual({ greeting: "Hello " });
		});
	});

	describe("create", () => {
		it("creates a post with valid name", async () => {
			const mockDb = createMockDb();
			const caller = appRouter.createCaller({
				db: mockDb as any,
				headers: new Headers(),
			});
			await expect(
				caller.post.create({ name: "Test Post" }),
			).resolves.toBeUndefined();
			expect(mockDb.insert).toHaveBeenCalled();
		});

		it("rejects empty name", async () => {
			const caller = appRouter.createCaller({
				db: createMockDb() as any,
				headers: new Headers(),
			});
			await expect(caller.post.create({ name: "" })).rejects.toThrow();
		});
	});

	describe("getLatest", () => {
		it("returns null when no posts exist", async () => {
			const caller = appRouter.createCaller({
				db: createMockDb() as any,
				headers: new Headers(),
			});
			const result = await caller.post.getLatest();
			expect(result).toBeNull();
		});

		it("returns the most recently created post", async () => {
			const mockDb = createMockDb();
			const caller = appRouter.createCaller({
				db: mockDb as any,
				headers: new Headers(),
			});

			// Manually add a post to the mock store
			mockDb.store.push({
				id: 1,
				name: "First",
				createdAt: new Date(),
				updatedAt: null,
			});

			const result = await caller.post.getLatest();
			expect(result).not.toBeNull();
			expect(result?.name).toBe("First");
		});

		it("returns a post object with expected shape", async () => {
			const mockDb = createMockDb();
			const caller = appRouter.createCaller({
				db: mockDb as any,
				headers: new Headers(),
			});

			mockDb.store.push({
				id: 1,
				name: "Shaped",
				createdAt: new Date(),
				updatedAt: null,
			});

			const result = await caller.post.getLatest();
			expect(result).toMatchObject({
				id: expect.any(Number),
				name: "Shaped",
				createdAt: expect.any(Date),
			});
		});
	});
});
