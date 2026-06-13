import { describe, expect, it, vi } from "vitest";

import {
	createEmptyGuestSnapshot,
	parseGuestSnapshot,
	serializeGuestSnapshot,
} from "~/lib/guest/schema";

describe("guest schema", () => {
	it("returns empty snapshot for null input", () => {
		expect(parseGuestSnapshot(null)).toEqual(createEmptyGuestSnapshot());
	});

	it("round-trips a valid snapshot", () => {
		const snapshot = {
			version: 1 as const,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Write tests",
					status: "active" as const,
					workType: "DEEP_WORK" as const,
					weight: 2,
					importance: 3 as const,
					urgency: 2 as const,
					effortMinutes: 30,
					commitmentHorizon: "ASAP" as const,
					sortOrder: 0,
					resumeNote: null,
					personaPresetId: null,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		};

		const raw = serializeGuestSnapshot(snapshot);
		const parsed = parseGuestSnapshot(raw);

		expect(parsed.version).toBe(1);
		expect(parsed.tasks).toHaveLength(1);
		expect(parsed.tasks[0]?.title).toBe("Write tests");
		expect(parsed.tasks[0]?.importance).toBe(3);
		expect(parsed.tasks[0]?.urgency).toBe(2);
		expect(parsed.tasks[0]?.effortMinutes).toBe(30);
		expect(parsed.tasks[0]?.commitmentHorizon).toBe("ASAP");
		expect(parsed.tasks[0]?.createdAt).toEqual(
			new Date("2026-05-29T10:00:00.000Z"),
		);
	});

	it("defaults Eisenhower fields for legacy snapshots", () => {
		const raw = JSON.stringify({
			version: 1,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Legacy task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 3,
					createdAt: "2026-05-29T10:00:00.000Z",
					updatedAt: null,
				},
			],
			sessions: [],
			cycles: [],
		});

		const parsed = parseGuestSnapshot(raw);
		expect(parsed.tasks[0]?.urgency).toBe(3);
		expect(parsed.tasks[0]?.importance).toBe(2);
		expect(parsed.tasks[0]?.effortMinutes).toBeNull();
		expect(parsed.tasks[0]?.commitmentHorizon).toBe("WHEN_POSSIBLE");
	});

	it("returns empty snapshot for corrupt JSON", () => {
		expect(parseGuestSnapshot("{not-json")).toEqual(createEmptyGuestSnapshot());
	});

	it("returns empty snapshot for unsupported version", () => {
		vi.stubEnv("NODE_ENV", "development");
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		const result = parseGuestSnapshot(
			JSON.stringify({ version: 99, tasks: [], sessions: [], cycles: [] }),
		);

		expect(result).toEqual(createEmptyGuestSnapshot());
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		vi.unstubAllEnvs();
	});
});
