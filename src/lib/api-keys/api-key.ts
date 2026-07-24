import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * API-key primitive for the MCP server (S-46).
 *
 * A key is a single opaque string handed to an external agent:
 *   `fsk_<tokenId>_<secret>`
 * - `tokenId` (16 random bytes, hex) is stored in plaintext and indexed — it drives
 *   an O(1) lookup at verification time. It is NOT a secret on its own.
 * - `secret` (32 random bytes, hex) is never stored; only `sha256(secret + pepper)` is.
 *
 * Hex encoding keeps the shape unambiguous (no `_` inside the segments), so parsing is
 * a strict regex. The high entropy of the secret plus the server-side pepper means a
 * DB leak alone does not yield usable keys.
 */

const KEY_PREFIX = "fsk";
const TOKEN_ID_BYTES = 16; // 32 hex chars
const SECRET_BYTES = 32; // 64 hex chars

const API_KEY_PATTERN = /^fsk_([0-9a-f]{32})_([0-9a-f]{64})$/;

export type GeneratedApiKey = {
	/** The full key string to show the user exactly once. */
	plaintext: string;
	/** Public, indexed identifier persisted alongside the hash. */
	tokenId: string;
	/** `sha256(secret + pepper)` hex digest — the only secret-derived value persisted. */
	hashedSecret: string;
};

/** Mix the secret with the server-side pepper before hashing. */
function hashSecret(secret: string): string {
	return createHash("sha256")
		.update(`${secret}${env.MCP_API_KEY_PEPPER}`)
		.digest("hex");
}

/** Generate a fresh key. The plaintext is returned once and never recoverable afterwards. */
export function generateApiKey(): GeneratedApiKey {
	const tokenId = randomBytes(TOKEN_ID_BYTES).toString("hex");
	const secret = randomBytes(SECRET_BYTES).toString("hex");
	return {
		plaintext: `${KEY_PREFIX}_${tokenId}_${secret}`,
		tokenId,
		hashedSecret: hashSecret(secret),
	};
}

/** Strictly parse a presented key. Returns null for any malformed input. */
export function parseApiKey(
	plaintext: string,
): { tokenId: string; secret: string } | null {
	const match = API_KEY_PATTERN.exec(plaintext);
	if (!match) return null;
	return { tokenId: match[1] as string, secret: match[2] as string };
}

/** Constant-time check of a presented secret against a stored hash. */
export function verifySecret(secret: string, hashedSecret: string): boolean {
	const expected = Buffer.from(hashedSecret, "hex");
	const actual = Buffer.from(hashSecret(secret), "hex");
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}
