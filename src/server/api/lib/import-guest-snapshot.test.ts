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

	it("preserves archived status and archivedAt on import", async () => {
		const createCalls: Array<Record<string, unknown>> = [];
		const archivedAt = new Date("2026-06-20T12:00:00.000Z");

		const db = {
			$transaction: vi.fn(
				async (
					fn: (tx: {
						cycle: {
							updateMany: ReturnType<typeof vi.fn>;
							create: ReturnType<typeof vi.fn>;
						};
						task: {
							findMany: ReturnType<typeof vi.fn>;
							aggregate: ReturnType<typeof vi.fn>;
							create: ReturnType<typeof vi.fn>;
						};
						session: { create: ReturnType<typeof vi.fn> };
					}) => Promise<unknown>,
				) => {
					const tx = {
						cycle: {
							updateMany: vi.fn().mockResolvedValue({ count: 0 }),
							create: vi.fn(),
						},
						task: {
							findMany: vi.fn().mockResolvedValue([]),
							aggregate: vi
								.fn()
								.mockResolvedValue({ _max: { sortOrder: null } }),
							create: vi.fn().mockImplementation(async ({ data }) => {
								createCalls.push(data);
								return { id: createCalls.length, ...data };
							}),
						},
						session: { create: vi.fn() },
					};
					return fn(tx);
				},
			),
		};

		const snapshot: GuestSnapshotV1 = {
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Stale task",
					status: "archived",
					workType: "OPERATIONAL",
					weight: 2,
					importance: 2,
					urgency: 2,
					effortMinutes: null,
					commitmentHorizon: "WHEN_POSSIBLE",
					sortOrder: 0,
					resumeNote: null,
					personaPresetId: null,
					isDailyStanding: false,
					archivedAt,
					createdAt: new Date("2026-05-20T10:00:00.000Z"),
					updatedAt: new Date("2026-05-20T10:00:00.000Z"),
				},
			],
			sessions: [],
			cycles: [],
		};

		const result = await importGuestSnapshot(db as never, "user-1", snapshot);

		expect(result).toEqual({ importedTasks: 1, importedCycles: 0 });
		expect(createCalls).toHaveLength(1);
		expect(createCalls[0]).toMatchObject({
			status: "archived",
			archivedAt,
		});
	});
});
