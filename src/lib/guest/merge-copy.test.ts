import { describe, expect, it } from "vitest";

import {
	buildMergeSuccessCopy,
	extractPreviewTaskTitles,
} from "~/lib/guest/merge-copy";
import {
	createEmptyGuestSnapshot,
	type GuestSnapshotV1,
	type GuestTask,
} from "~/lib/guest/schema";

function makeTask(partial: {
	id: string;
	title: string;
	status: "active" | "completed";
	createdAt: Date;
	sortOrder?: number;
}): GuestTask {
	return {
		...partial,
		workType: "OPERATIONAL",
		weight: 2,
		sortOrder: partial.sortOrder ?? 0,
		updatedAt: null,
	};
}

function snapshotWithTasks(tasks: GuestTask[]): GuestSnapshotV1 {
	return { ...createEmptyGuestSnapshot(), tasks };
}

describe("extractPreviewTaskTitles", () => {
	it("returns empty array when snapshot has no tasks", () => {
		expect(extractPreviewTaskTitles(createEmptyGuestSnapshot())).toEqual([]);
	});

	it("orders active tasks before completed; active by sortOrder, completed by createdAt", () => {
		const snapshot = snapshotWithTasks([
			makeTask({
				id: "1",
				title: "Completed old",
				status: "completed",
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
			}),
			makeTask({
				id: "2",
				title: "Active later",
				status: "active",
				sortOrder: 1,
				createdAt: new Date("2026-01-03T10:00:00.000Z"),
			}),
			makeTask({
				id: "3",
				title: "Active earlier",
				status: "active",
				sortOrder: 0,
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
			}),
			makeTask({
				id: "4",
				title: "Completed new",
				status: "completed",
				createdAt: new Date("2026-01-04T10:00:00.000Z"),
			}),
		]);

		expect(extractPreviewTaskTitles(snapshot)).toEqual([
			"Active earlier",
			"Active later",
			"Completed old",
		]);
	});

	it("includes completed tasks when fewer than maxTitles active tasks exist", () => {
		const snapshot = snapshotWithTasks([
			makeTask({
				id: "1",
				title: "Only active",
				status: "active",
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
			}),
			makeTask({
				id: "2",
				title: "Done one",
				status: "completed",
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
			}),
			makeTask({
				id: "3",
				title: "Done two",
				status: "completed",
				createdAt: new Date("2026-01-03T10:00:00.000Z"),
			}),
		]);

		expect(extractPreviewTaskTitles(snapshot, 3)).toEqual([
			"Only active",
			"Done one",
			"Done two",
		]);
	});

	it("limits results to maxTitles (default 3)", () => {
		const snapshot = snapshotWithTasks([
			makeTask({
				id: "1",
				title: "Task one",
				status: "active",
				sortOrder: 0,
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
			}),
			makeTask({
				id: "2",
				title: "Task two",
				status: "active",
				sortOrder: 1,
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
			}),
			makeTask({
				id: "3",
				title: "Task three",
				status: "active",
				sortOrder: 2,
				createdAt: new Date("2026-01-03T10:00:00.000Z"),
			}),
			makeTask({
				id: "4",
				title: "Task four",
				status: "active",
				sortOrder: 3,
				createdAt: new Date("2026-01-04T10:00:00.000Z"),
			}),
			makeTask({
				id: "5",
				title: "Task five",
				status: "active",
				sortOrder: 4,
				createdAt: new Date("2026-01-05T10:00:00.000Z"),
			}),
		]);

		expect(extractPreviewTaskTitles(snapshot)).toEqual([
			"Task one",
			"Task two",
			"Task three",
		]);
	});

	it("skips tasks with empty titles", () => {
		const snapshot = snapshotWithTasks([
			makeTask({
				id: "1",
				title: "   ",
				status: "active",
				createdAt: new Date("2026-01-01T10:00:00.000Z"),
			}),
			makeTask({
				id: "2",
				title: "Valid task",
				status: "active",
				createdAt: new Date("2026-01-02T10:00:00.000Z"),
			}),
		]);

		expect(extractPreviewTaskTitles(snapshot)).toEqual(["Valid task"]);
	});
});

describe("buildMergeSuccessCopy", () => {
	it("uses singular grammar for 1 task and 1 cycle", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 1,
			importedCycles: 1,
			previewTitles: ["Write tests"],
		});

		expect(copy.title).toBeTruthy();
		expect(copy.body).toContain("1 task");
		expect(copy.body).toContain("1 cycle");
		expect(copy.body).not.toMatch(/\b1 tasks\b/);
		expect(copy.body).not.toMatch(/\b1 cycles\b/);
		expect(copy.body).toContain("Write tests");
		expect(copy.dismissLabel).toBe("Continue");
	});

	it("uses plural grammar for multiple tasks and cycles", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 3,
			importedCycles: 2,
			previewTitles: ["Alpha", "Beta", "Gamma"],
		});

		expect(copy.body).toContain("3 tasks");
		expect(copy.body).toContain("2 cycles");
		expect(copy.body).toContain("Alpha");
		expect(copy.body).toContain("Beta");
		expect(copy.body).toContain("Gamma");
	});

	it("handles cycles-only import with no preview titles", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 0,
			importedCycles: 2,
			previewTitles: [],
		});

		expect(copy.body).toContain("2 cycles");
		expect(copy.body).not.toContain("0 tasks");
		expect(copy.body).not.toMatch(/Imported.*\btask/i);
	});

	it("handles counts with no preview titles (tasks imported but titles empty)", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 2,
			importedCycles: 0,
			previewTitles: [],
		});

		expect(copy.body).toContain("2 tasks");
		expect(copy.body).not.toContain("+");
	});

	it("shows overflow hint when importedTasks exceeds previewTitles length", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 5,
			importedCycles: 0,
			previewTitles: ["One", "Two", "Three"],
		});

		expect(copy.body).toContain("One");
		expect(copy.body).toContain("Two");
		expect(copy.body).toContain("Three");
		expect(copy.body).toContain("+ 2 more");
	});

	it("does not show overflow hint when all tasks fit in preview", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 3,
			importedCycles: 0,
			previewTitles: ["One", "Two", "Three"],
		});

		expect(copy.body).not.toContain("+");
	});

	it("mentions unlocked features in the body", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 1,
			importedCycles: 0,
			previewTitles: ["Focus work"],
		});

		expect(copy.body).toMatch(/full sessions/i);
		expect(copy.body).toMatch(/check-in/i);
		expect(copy.body).toMatch(/suggestion/i);
	});
});
