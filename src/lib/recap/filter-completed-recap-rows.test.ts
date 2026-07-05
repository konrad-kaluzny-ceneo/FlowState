import { describe, expect, it } from "vitest";

import { filterCompletedRecapRows } from "~/lib/recap/filter-completed-recap-rows";
import type { RecapTaskRow } from "~/lib/recap/types";

const baseRow: RecapTaskRow = {
	taskId: 1,
	title: "Ship feature",
	firstStartedAt: new Date("2026-06-20T10:00:00Z"),
	lastEndedAt: new Date("2026-06-20T10:25:00Z"),
	focusedMinutes: 25,
	workType: "DEEP_WORK",
	effortMinutes: 30,
	isCompleted: false,
};

describe("filterCompletedRecapRows", () => {
	it("keeps rows marked completed on the task", () => {
		const rows = [{ ...baseRow, isCompleted: true }];
		expect(filterCompletedRecapRows(rows)).toHaveLength(1);
	});

	it("keeps mark-done-without-cycle rows", () => {
		const rows = [
			{
				...baseRow,
				focusedMinutes: 0,
				isCompleted: true,
				completedWithoutCycle: true,
			},
		];
		expect(filterCompletedRecapRows(rows)).toHaveLength(1);
	});

	it("drops in-progress focus rows", () => {
		expect(filterCompletedRecapRows([baseRow])).toHaveLength(0);
	});

	it("filters a mixed list", () => {
		const rows: RecapTaskRow[] = [
			baseRow,
			{ ...baseRow, taskId: 2, isCompleted: true },
			{
				...baseRow,
				taskId: 3,
				focusedMinutes: 0,
				isCompleted: true,
				completedWithoutCycle: true,
			},
		];
		expect(filterCompletedRecapRows(rows).map((row) => row.taskId)).toEqual([
			2, 3,
		]);
	});
});
