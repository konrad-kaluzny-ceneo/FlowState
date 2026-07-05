import type { Task as PrismaTask } from "@prisma/generated";
import { describe, expect, it } from "vitest";

import { mapTaskFromPrisma } from "./task-mapper";

function makeRow(overrides: Partial<PrismaTask> = {}): PrismaTask {
	return {
		id: 1,
		title: "Task",
		status: "active",
		userId: "user-1",
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		sortOrder: 0,
		resumeNote: null,
		project: null,
		personaPresetId: null,
		isDailyStanding: false,
		archivedAt: null,
		createdAt: new Date("2026-07-01T00:00:00.000Z"),
		updatedAt: null,
		...overrides,
	} as PrismaTask;
}

describe("mapTaskFromPrisma", () => {
	it("maps a planned status row without throwing", () => {
		const row = makeRow({ status: "planned" });
		expect(() => mapTaskFromPrisma(row)).not.toThrow();
		expect(mapTaskFromPrisma(row).status).toBe("planned");
	});

	it("maps a null project to null and a stored project through", () => {
		expect(mapTaskFromPrisma(makeRow()).project).toBeNull();
		expect(mapTaskFromPrisma(makeRow({ project: "Acme" })).project).toBe(
			"Acme",
		);
	});
});
