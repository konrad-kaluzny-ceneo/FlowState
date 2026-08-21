import { describe, expect, it } from "vitest";

import { derivePlanScoringFields } from "./plan-scoring-context";

describe("derivePlanScoringFields", () => {
	it("boosts the focus task on the active block", () => {
		const fields = derivePlanScoringFields(
			[
				{
					blockType: "FOCUS",
					startMinute: 540,
					durationMinutes: 60,
					focusTaskId: 42,
					batchTaskIds: [],
				},
			],
			570,
		);

		expect(fields.planActiveFocusTaskId).toBe(42);
		expect(fields.planPlannedFocusTaskIds).toEqual([42]);
	});

	it("includes upcoming focus blocks but not past ones", () => {
		const fields = derivePlanScoringFields(
			[
				{
					blockType: "FOCUS",
					startMinute: 480,
					durationMinutes: 30,
					focusTaskId: 1,
					batchTaskIds: [],
				},
				{
					blockType: "FOCUS",
					startMinute: 600,
					durationMinutes: 30,
					focusTaskId: 2,
					batchTaskIds: [],
				},
			],
			540,
		);

		expect(fields.planActiveFocusTaskId).toBeNull();
		expect(fields.planPlannedFocusTaskIds).toEqual([2]);
	});

	it("collects batch tasks from the active batch block", () => {
		const fields = derivePlanScoringFields(
			[
				{
					blockType: "BATCH",
					startMinute: 540,
					durationMinutes: 45,
					focusTaskId: null,
					batchTaskIds: [10, 11],
				},
			],
			555,
		);

		expect(fields.planActiveBatchTaskIds).toEqual([10, 11]);
		expect(fields.planPlannedBatchTaskIds).toEqual([10, 11]);
	});
});
