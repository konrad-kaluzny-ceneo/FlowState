import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateApiKey } from "~/lib/api-keys/api-key";

/**
 * Feature: MCP API keys (S-46), Property: key → identity bridge.
 * Validates: a presented bearer key resolves to the right identity + scope,
 * fails closed (null) for invalid/revoked/unknown keys, and bumps lastUsedAt.
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
	expiresAt: Date | null;
	revokedAt: Date | null;
};

let rows: ApiKeyRow[] = [];
let nextId = 1;

vi.mock("~/server/db/index", () => {
	const findUnique = vi.fn((args: { where: { tokenId: string } }) =>
		Promise.resolve(rows.find((r) => r.tokenId === args.where.tokenId) ?? null),
	);
	const update = vi.fn(
		(args: { where: { tokenId: string }; data: { lastUsedAt: Date } }) => {
			const row = rows.find((r) => r.tokenId === args.where.tokenId);
			if (!row) throw new Error("not found");
			Object.assign(row, args.data);
			return Promise.resolve(row);
		},
	);
	return { db: { apiKey: { findUnique, update } } };
});

const { verifyApiKey, buildMcpContext } = await import(
	"~/lib/api-keys/verify-token"
);
const { db } = await import("~/server/db/index");

function seed(overrides?: Partial<ApiKeyRow>): {
	plaintext: string;
	row: ApiKeyRow;
} {
	const { plaintext, tokenId, hashedSecret } = generateApiKey();
	const row: ApiKeyRow = {
		id: nextId++,
		userId: "user-1",
		name: "Test key",
		tokenId,
		hashedSecret,
		scope: "READ_WRITE",
		userEmail: "user-1@example.com",
		userName: "User One",
		createdAt: new Date(),
		lastUsedAt: null,
		expiresAt: null,
		revokedAt: null,
		...overrides,
	};
	rows.push(row);
	return { plaintext, row };
}

describe("Feature: MCP API keys (S-46), Property: key → identity bridge", () => {
	beforeEach(() => {
		rows = [];
		nextId = 1;
		vi.clearAllMocks();
	});

	it("resolves a valid key to its identity and scope", async () => {
		const { plaintext } = seed({
			userId: "user-42",
			userEmail: "u42@example.com",
			userName: "Forty Two",
			scope: "READ",
		});

		const result = await verifyApiKey(plaintext);

		expect(result).toEqual({
			userId: "user-42",
			userEmail: "u42@example.com",
			userName: "Forty Two",
			scope: "READ",
		});
	});

	it("surfaces the READ_WRITE scope", async () => {
		const { plaintext } = seed({ scope: "READ_WRITE" });
		const result = await verifyApiKey(plaintext);
		expect(result?.scope).toBe("READ_WRITE");
	});

	it("bumps lastUsedAt on success", async () => {
		const { plaintext, row } = seed();
		expect(row.lastUsedAt).toBeNull();

		await verifyApiKey(plaintext);

		expect(db.apiKey.update).toHaveBeenCalledOnce();
		expect(row.lastUsedAt).toBeInstanceOf(Date);
	});

	it("returns null for a malformed key without hitting the DB", async () => {
		const result = await verifyApiKey("not-a-valid-key");
		expect(result).toBeNull();
		expect(db.apiKey.findUnique).not.toHaveBeenCalled();
	});

	it("returns null for an unknown tokenId (well-formed but not stored)", async () => {
		const { plaintext } = generateApiKey();
		const result = await verifyApiKey(plaintext);
		expect(result).toBeNull();
		expect(db.apiKey.findUnique).toHaveBeenCalledOnce();
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});

	it("returns null for a revoked key (no lastUsedAt bump)", async () => {
		const { plaintext } = seed({ revokedAt: new Date() });
		const result = await verifyApiKey(plaintext);
		expect(result).toBeNull();
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});

	it("returns null for an expired key (no lastUsedAt bump)", async () => {
		const { plaintext } = seed({ expiresAt: new Date(Date.now() - 1000) });
		const result = await verifyApiKey(plaintext);
		expect(result).toBeNull();
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});

	it("accepts a key whose expiry is still in the future", async () => {
		const { plaintext } = seed({
			expiresAt: new Date(Date.now() + 60_000),
		});
		const result = await verifyApiKey(plaintext);
		expect(result).not.toBeNull();
	});

	it("returns null when the secret does not match the stored hash", async () => {
		const { plaintext } = seed();
		// Flip the last hex char of the secret segment — same tokenId, wrong secret.
		const lastChar = plaintext.at(-1);
		const swapped = lastChar === "0" ? "1" : "0";
		const tampered = plaintext.slice(0, -1) + swapped;

		const result = await verifyApiKey(tampered);

		expect(result).toBeNull();
		expect(db.apiKey.findUnique).toHaveBeenCalledOnce();
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});

	it("buildMcpContext produces an enforceAuth-satisfying session", () => {
		const ctx = buildMcpContext({
			userId: "abc",
			userEmail: "abc@example.com",
			userName: "ABC",
			scope: "READ",
		});

		expect(ctx.session.user).toEqual({
			id: "abc",
			email: "abc@example.com",
			name: "ABC",
		});
		expect(ctx.headers).toBeInstanceOf(Headers);
		expect(ctx.db).toBeDefined();
	});
});
