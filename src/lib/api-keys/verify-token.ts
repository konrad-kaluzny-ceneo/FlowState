import type { ApiKeyScope } from "@prisma/generated";

import { parseApiKey, verifySecret } from "~/lib/api-keys/api-key";
import { db } from "~/server/db/index";

/**
 * Key → identity bridge for the MCP server (S-46).
 *
 * A presented bearer key is resolved to a live user identity + scope by:
 *   1. strict `parseApiKey` (format check — no DB hit for garbage input),
 *   2. an O(1) indexed lookup by the public `tokenId`,
 *   3. a revocation + expiry check,
 *   4. a constant-time secret comparison.
 *
 * ANY failure returns `null` with no distinguishing error — a bad token, an
 * unknown token id, a revoked key, and a wrong secret are indistinguishable to
 * the caller. Neither the plaintext key nor the pepper is ever logged.
 */

export type VerifiedApiKey = {
	userId: string;
	userEmail: string;
	userName: string;
	scope: ApiKeyScope;
};

/** The synthetic tRPC context shape `createCaller` expects (mirrors `createTRPCContext`). */
export type McpTrpcContext = {
	db: typeof db;
	session: { user: { id: string; email: string; name: string } };
	headers: Headers;
};

/**
 * Resolve a presented bearer token to an identity + scope, bumping `lastUsedAt`
 * on success. Returns `null` on any authentication failure.
 */
export async function verifyApiKey(
	bearerToken: string,
): Promise<VerifiedApiKey | null> {
	const parsed = parseApiKey(bearerToken);
	if (parsed == null) return null;

	const row = await db.apiKey.findUnique({
		where: { tokenId: parsed.tokenId },
	});
	if (row == null) return null;
	if (row.revokedAt != null) return null;
	if (row.expiresAt != null && row.expiresAt.getTime() <= Date.now())
		return null;
	if (!verifySecret(parsed.secret, row.hashedSecret)) return null;

	// Identity is resolved — a failure to stamp last-used must not flip a valid
	// key to unauthorized, so tolerate errors on this best-effort write.
	try {
		await db.apiKey.update({
			where: { tokenId: parsed.tokenId },
			data: { lastUsedAt: new Date() },
		});
	} catch {
		// non-fatal
	}

	return {
		userId: row.userId,
		userEmail: row.userEmail,
		userName: row.userName,
		scope: row.scope,
	};
}

/**
 * Build the synthetic tRPC context from a verified key. The MCP path bypasses
 * cookie-based `createTRPCContext` entirely and injects the identity captured on
 * the key row so `protectedProcedure`'s `enforceAuth` (which requires id, email,
 * and name) is satisfied.
 */
export function buildMcpContext(
	identity: VerifiedApiKey,
	headers?: Headers,
): McpTrpcContext {
	return {
		db,
		session: {
			user: {
				id: identity.userId,
				email: identity.userEmail,
				name: identity.userName,
			},
		},
		headers: headers ?? new Headers(),
	};
}
