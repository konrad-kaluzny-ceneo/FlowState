import { describe, expect, it } from "vitest";

import type { DomainTask } from "~/lib/data-mode/types";
import { defaultEisenhowerFields } from "~/lib/data-mode/types";

import { selectFocusReadyTasks } from "./focus-ready-state";

function makeTask(
	overrides: Partial<DomainTask> & Pick<DomainTask, "id" | "title" | "status">,
): DomainTask {
	return {
		userId: "user-1",
		createdAt: new Date(),
		updatedAt: null,
		workType: "OPERATIONAL",
		weight: 2,
		...defaultEisenhowerFields(2),
		sortOrder: 0,
		resumeNote: null,
		project: null,
		archivedAt: null,
		personaPresetId: null,
		isDailyStanding: false,
		...overrides,
	};
}

describe("selectFocusReadyTasks", () => {
	it("includes active and planned tasks, active first", () => {
		const tasks = [
			makeTask({
				id: "p1",
				title: "Planned first",
				status: "planned",
				sortOrder: 0,
			}),
			makeTask({
				id: "a1",
				title: "Active first",
				status: "active",
				sortOrder: 1,
			}),
			makeTask({
				id: "p2",
				title: "Planned second",
				status: "planned",
				sortOrder: 2,
			}),
		];

		const selected = selectFocusReadyTasks(tasks);

		expect(selected.map((task) => task.id)).toEqual(["a1", "p1", "p2"]);
	});

	it("excludes completed and archived tasks", () => {
		const tasks = [
			makeTask({ id: "done", title: "Done", status: "completed" }),
			makeTask({ id: "arch", title: "Archived", status: "archived" }),
			makeTask({ id: "plan", title: "Planned", status: "planned" }),
		];

		expect(selectFocusReadyTasks(tasks).map((task) => task.id)).toEqual([
			"plan",
		]);
	});

	it("returns at most three tasks", () => {
		const tasks = Array.from({ length: 5 }, (_, index) =>
			makeTask({
				id: `task-${index}`,
				title: `Task ${index}`,
				status: "planned",
				sortOrder: index,
			}),
		);

		expect(selectFocusReadyTasks(tasks)).toHaveLength(3);
	});

	it("pins auto-suggested task into the shortlist when it would otherwise be omitted", () => {
		const tasks = Array.from({ length: 4 }, (_, index) =>
			makeTask({
				id: index + 1,
				title: `Task ${index + 1}`,
				status: "active",
				sortOrder: index,
			}),
		);

		const selected = selectFocusReadyTasks(tasks, 4);

		expect(selected.map((task) => task.id)).toEqual([4, 1, 2]);
	});
});
