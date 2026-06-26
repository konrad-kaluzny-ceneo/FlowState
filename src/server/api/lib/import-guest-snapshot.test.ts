import { describe, expect, it, vi } from "vitest";

import type { GuestSnapshotV1 } from "~/lib/guest/schema";
import {
	importGuestSnapshot,
	resolveUniqueTitle,
} from "~/server/api/lib/import-guest-snapshot";

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

describe("importGuestSnapshot", () => {
	it("returns zero counts for empty snapshot without opening a transaction", async () => {
		const $transaction = vi.fn();
		const db = { $transaction } as never;

		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [],
			sessions: [],
			cycles: [],
		};

		const result = await importGuestSnapshot(db, "user-1", snapshot);

		expect(result).toEqual({ importedTasks: 0, importedCycles: 0 });
		expect($transaction).not.toHaveBeenCalled();
	});
});
