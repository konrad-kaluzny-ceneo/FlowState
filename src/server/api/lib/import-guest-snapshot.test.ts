import { describe, expect, it } from "vitest";

import { resolveUniqueTitle } from "~/server/api/lib/import-guest-snapshot";

describe("resolveUniqueTitle", () => {
	it("returns the title when no collision exists", () => {
		const titles = new Set(["Other"]);
		expect(resolveUniqueTitle("Foo", titles)).toBe("Foo");
	});

	it("appends (2) when title exists", () => {
		const titles = new Set(["Foo"]);
		expect(resolveUniqueTitle("Foo", titles)).toBe("Foo (2)");
	});

	it("finds the next free suffix", () => {
		const titles = new Set(["Foo", "Foo (2)", "Foo (3)"]);
		expect(resolveUniqueTitle("Foo", titles)).toBe("Foo (4)");
	});
});
