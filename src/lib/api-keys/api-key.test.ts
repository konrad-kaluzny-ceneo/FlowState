import { describe, expect, it } from "vitest";

import {
	generateApiKey,
	parseApiKey,
	verifySecret,
} from "~/lib/api-keys/api-key";

describe("generateApiKey", () => {
	it("produces a well-formed fsk_<tokenId>_<secret> key", () => {
		const key = generateApiKey();
		expect(key.plaintext).toMatch(/^fsk_[0-9a-f]{32}_[0-9a-f]{64}$/);
		expect(key.tokenId).toHaveLength(32);
		expect(key.hashedSecret).toHaveLength(64);
	});

	it("embeds the returned tokenId in the plaintext", () => {
		const key = generateApiKey();
		expect(parseApiKey(key.plaintext)?.tokenId).toBe(key.tokenId);
	});

	it("never stores the raw secret in the returned hash", () => {
		const key = generateApiKey();
		const secret = parseApiKey(key.plaintext)?.secret ?? "";
		expect(key.hashedSecret).not.toContain(secret);
	});

	it("generates unique keys across calls", () => {
		const a = generateApiKey();
		const b = generateApiKey();
		expect(a.tokenId).not.toBe(b.tokenId);
		expect(a.plaintext).not.toBe(b.plaintext);
	});
});

describe("parseApiKey", () => {
	it("round-trips a generated key", () => {
		const key = generateApiKey();
		const parsed = parseApiKey(key.plaintext);
		expect(parsed).not.toBeNull();
		expect(parsed?.tokenId).toBe(key.tokenId);
	});

	it.each([
		["empty", ""],
		["missing prefix", "abc_" + "a".repeat(32) + "_" + "b".repeat(64)],
		["wrong prefix", "xyz_" + "a".repeat(32) + "_" + "b".repeat(64)],
		["short tokenId", "fsk_" + "a".repeat(31) + "_" + "b".repeat(64)],
		["short secret", "fsk_" + "a".repeat(32) + "_" + "b".repeat(63)],
		["uppercase hex", "fsk_" + "A".repeat(32) + "_" + "b".repeat(64)],
		["no secret segment", "fsk_" + "a".repeat(32)],
		["trailing junk", "fsk_" + "a".repeat(32) + "_" + "b".repeat(64) + "x"],
	])("rejects malformed input (%s)", (_label, input) => {
		expect(parseApiKey(input)).toBeNull();
	});
});

describe("verifySecret", () => {
	it("accepts the correct secret", () => {
		const key = generateApiKey();
		const secret = parseApiKey(key.plaintext)?.secret ?? "";
		expect(verifySecret(secret, key.hashedSecret)).toBe(true);
	});

	it("rejects a tampered secret", () => {
		const key = generateApiKey();
		const secret = parseApiKey(key.plaintext)?.secret ?? "";
		const tampered = `${secret.slice(0, -1)}${secret.endsWith("a") ? "b" : "a"}`;
		expect(verifySecret(tampered, key.hashedSecret)).toBe(false);
	});

	it("rejects a secret from a different key", () => {
		const a = generateApiKey();
		const b = generateApiKey();
		const secretB = parseApiKey(b.plaintext)?.secret ?? "";
		expect(verifySecret(secretB, a.hashedSecret)).toBe(false);
	});

	it("returns false for a malformed stored hash rather than throwing", () => {
		const key = generateApiKey();
		const secret = parseApiKey(key.plaintext)?.secret ?? "";
		expect(verifySecret(secret, "deadbeef")).toBe(false);
	});
});
