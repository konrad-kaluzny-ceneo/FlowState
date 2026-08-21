import type { PrismaClient } from "@prisma/generated";

import type { ScheduleBlockType } from "~/lib/schedule/types";
import type { ScoringContext } from "~/lib/scoring/score-task";

export type PlanBlockInput = {
	blockType: ScheduleBlockType;
	startMinute: number;
	durationMinutes: number;
	focusTaskId: number | null;
	batchTaskIds: readonly number[];
};

export type PlanScoringFields = Pick<
	ScoringContext,
	| "planActiveFocusTaskId"
	| "planActiveBatchTaskIds"
	| "planPlannedFocusTaskIds"
	| "planPlannedBatchTaskIds"
>;

const EMPTY_PLAN_SCORING: PlanScoringFields = {
	planActiveFocusTaskId: null,
	planActiveBatchTaskIds: [],
	planPlannedFocusTaskIds: [],
	planPlannedBatchTaskIds: [],
};

function isBlockActive(
	block: PlanBlockInput,
	localMinuteOfDay: number,
): boolean {
	return (
		localMinuteOfDay >= block.startMinute &&
		localMinuteOfDay < block.startMinute + block.durationMinutes
	);
}

export function derivePlanScoringFields(
	blocks: readonly PlanBlockInput[],
	localMinuteOfDay: number,
): PlanScoringFields {
	if (blocks.length === 0) {
		return EMPTY_PLAN_SCORING;
	}

	let planActiveFocusTaskId: number | null = null;
	const planActiveBatchTaskIds: number[] = [];
	const planPlannedFocusTaskIds: number[] = [];
	const planPlannedBatchTaskIds: number[] = [];

	for (const block of blocks) {
		const blockEnd = block.startMinute + block.durationMinutes;
		if (blockEnd <= localMinuteOfDay) {
			continue;
		}

		const active = isBlockActive(block, localMinuteOfDay);

		if (block.blockType === "FOCUS" && block.focusTaskId != null) {
			planPlannedFocusTaskIds.push(block.focusTaskId);
			if (active) {
				planActiveFocusTaskId = block.focusTaskId;
			}
		}

		if (block.blockType === "BATCH" && block.batchTaskIds.length > 0) {
			for (const taskId of block.batchTaskIds) {
				planPlannedBatchTaskIds.push(taskId);
				if (active) {
					planActiveBatchTaskIds.push(taskId);
				}
			}
		}
	}

	return {
		planActiveFocusTaskId,
		planActiveBatchTaskIds,
		planPlannedFocusTaskIds,
		planPlannedBatchTaskIds,
	};
}

type PlanScoringDb = Pick<PrismaClient, "scheduleBlock">;

export async function loadPlanScoringFields(
	db: PlanScoringDb,
	userId: string,
	localDateKey: string,
	localMinuteOfDay: number,
): Promise<PlanScoringFields> {
	const rows = await db.scheduleBlock.findMany({
		where: { userId, localDateKey },
		orderBy: { startMinute: "asc" },
		select: {
			blockType: true,
			startMinute: true,
			durationMinutes: true,
			focusTaskId: true,
			batchTasks: {
				select: { taskId: true },
				orderBy: { sortOrder: "asc" },
			},
		},
	});

	return derivePlanScoringFields(
		rows.map((row) => ({
			blockType: row.blockType,
			startMinute: row.startMinute,
			durationMinutes: row.durationMinutes,
			focusTaskId: row.focusTaskId,
			batchTaskIds: row.batchTasks.map((link) => link.taskId),
		})),
		localMinuteOfDay,
	);
}
