import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: MCP API keys (S-46), Property: API-key isolation
 * Validates: NFR data isolation — a user can only list or revoke their own keys.
 */

type ApiKeyRow = {
	id: number;
	userId: string;
	name: string;
	tokenId: string;
	hashedSecret: string;
	scope: "READ" | "READ_WRITE";
	userEmail: string;
	userName: string;
	createdAt: Date;
	lastUsedAt: Date | null;
	revokedAt: Date | null;
};

// Store all keys in an in-memory array; the mock db will filter them.
let allKeys: ApiKeyRow[] = [];
let nextId = 1;

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock the api-key primitive so tests never touch real crypto / the pepper env.
vi.mock("~/lib/api-keys/api-key", () => ({
	generateApiKey: vi.fn(() => ({
		plaintext: "fsk_test_plaintext",
		tokenId: `token-${nextId}`,
		hashedSecret: `hashed-${nextId}`,
	})),
}));

// Mock ~/server/db/index with a Prisma-style apiKey delegate.
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn(
		(args: {
			where?: { userId?: string };
			orderBy?: { createdAt?: "asc" | "desc" };
		}) => {
			const userId = args?.where?.userId;
			let rows = allKeys.filter((k) => userId == null || k.userId === userId);
			if (args?.orderBy?.createdAt) {
				const dir = args.orderBy.createdAt === "asc" ? 1 : -1;
				rows = [...rows].sort(
					(a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * dir,
				);
			}
			return Promise.resolve(
				rows.map((k) => ({
					id: k.id,
					name: k.name,
					scope: k.scope,
					tokenId: k.tokenId,
					createdAt: k.createdAt,
					lastUsedAt: k.lastUsedAt,
					revokedAt: k.revokedAt,
				})),
			);
		},
	);

	const mockCreate = vi.fn(
		(args: {
			data: {
				userId: string;
				name: string;
				scope: "READ" | "READ_WRITE";
				tokenId: string;
				hashedSecret: string;
				userEmail: string;
				userName: string;
			};
		}) => {
			const row: ApiKeyRow = {
				id: nextId++,
				userId: args.data.userId,
				name: args.data.name,
				tokenId: args.data.tokenId,
				hashedSecret: args.data.hashedSecret,
				scope: args.data.scope,
				userEmail: args.data.userEmail,
				userName: args.data.userName,
				createdAt: new Date(),
				lastUsedAt: null,
				revokedAt: null,
			};
			allKeys.push(row);
			return Promise.resolve({ id: row.id });
		},
	);

	const mockFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string } }) => {
			return Promise.resolve(
				allKeys.find(
					(k) =>
						(args?.where?.id == null || k.id === args.where.id) &&
						(args?.where?.userId == null || k.userId === args.where.userId),
				) ?? null,
			);
		},
	);

	const mockUpdate = vi.fn(
		(args: { where: { id: number }; data: { revokedAt: Date } }) => {
			const row = allKeys.find((k) => k.id === args.where.id);
			if (!row) {
				throw new Error("not found");
			}
			Object.assign(row, args.data);
			return Promise.resolve(row);
		},
	);

	return {
		db: {
			apiKey: {
				findMany: mockFindMany,
				create: mockCreate,
				findFirst: mockFindFirst,
				update: mockUpdate,
			},
		},
	};
});

// Import after mocks are set up.
const { createCallerFactory } = await import("~/server/api/trpc");
const { apiKeyRouter } = await import("~/server/api/routers/api-key");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(apiKeyRouter);

const USER_A = "user-a";
const USER_B = "user-b";

function apiKeyCaller(userId: string) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: `${userId}@example.com`,
				name: `User ${userId}`,
			},
		},
		headers: new Headers(),
	});
}

describe("Feature: MCP API keys (S-46), Property: API-key isolation", () => {
	beforeEach(() => {
		allKeys = [];
		nextId = 1;
		vi.clearAllMocks();
	});

	it("list never returns another user's keys", async () => {
		await apiKeyCaller(USER_A).create({ name: "A key", scope: "READ" });
		await apiKeyCaller(USER_B).create({ name: "B key", scope: "READ_WRITE" });

		const aList = await apiKeyCaller(USER_A).list();
		expect(aList).toHaveLength(1);
		expect(aList[0]?.name).toBe("A key");

		const bList = await apiKeyCaller(USER_B).list();
		expect(bList).toHaveLength(1);
		expect(bList[0]?.name).toBe("B key");
	});

	it("list never leaks the hashed secret or plaintext", async () => {
		await apiKeyCaller(USER_A).create({ name: "A key", scope: "READ" });

		const aList = await apiKeyCaller(USER_A).list();
		const entry = aList[0] as Record<string, unknown> | undefined;
		expect(entry).toBeDefined();
		expect(entry).not.toHaveProperty("hashedSecret");
		expect(entry).not.toHaveProperty("plaintext");
		expect(entry).not.toHaveProperty("secret");
	});

	it("create returns the plaintext exactly once and persists only the hash", async () => {
		const created = await apiKeyCaller(USER_A).create({
			name: "A key",
			scope: "READ_WRITE",
		});

		expect(created.plaintext).toBe("fsk_test_plaintext");
		expect(created.id).toBeTypeOf("number");

		const stored = allKeys.find((k) => k.id === created.id);
		expect(stored?.hashedSecret).toBe("hashed-1");
		// The plaintext must never be persisted.
		expect(JSON.stringify(stored)).not.toContain("fsk_test_plaintext");
	});

	it("revoke marks the caller's own key revoked", async () => {
		const created = await apiKeyCaller(USER_A).create({
			name: "A key",
			scope: "READ",
		});

		await apiKeyCaller(USER_A).revoke({ id: created.id });

		const stored = allKeys.find((k) => k.id === created.id);
		expect(stored?.revokedAt).toBeInstanceOf(Date);
	});

	it("a user cannot revoke another user's key (throws NOT_FOUND, no write)", async () => {
		const created = await apiKeyCaller(USER_A).create({
			name: "A key",
			scope: "READ",
		});

		await expect(
			apiKeyCaller(USER_B).revoke({ id: created.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const stored = allKeys.find((k) => k.id === created.id);
		expect(stored?.revokedAt).toBeNull();
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});
});
