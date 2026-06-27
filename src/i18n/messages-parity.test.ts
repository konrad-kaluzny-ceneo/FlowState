import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function collectKeys(value: unknown, prefix = ""): string[] {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return prefix ? [prefix] : [];
	}

	return Object.entries(value).flatMap(([key, nested]) => {
		const nextPrefix = prefix ? `${prefix}.${key}` : key;
		if (
			nested !== null &&
			typeof nested === "object" &&
			!Array.isArray(nested)
		) {
			return collectKeys(nested, nextPrefix);
		}

		return [nextPrefix];
	});
}

const messagesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../messages",
);

describe("message catalog parity", () => {
	it("en and pl catalogs share the same key structure", () => {
		const en = JSON.parse(
			readFileSync(join(messagesDir, "en.json"), "utf8"),
		) as unknown;
		const pl = JSON.parse(
			readFileSync(join(messagesDir, "pl.json"), "utf8"),
		) as unknown;

		expect(collectKeys(en).sort()).toEqual(collectKeys(pl).sort());
	});
});
