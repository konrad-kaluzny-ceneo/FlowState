import type { Task as PrismaTask } from "@prisma/generated";

import type { DomainTask } from "~/lib/data-mode/types";
import {
	fromPrismaCommitmentHorizon,
	fromPrismaWorkType,
} from "~/lib/persistence/prisma/enum-mappers";

export function mapTaskFromPrisma(
	row: PrismaTask,
	options?: { doneForToday?: boolean },
): DomainTask {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		userId: row.userId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		workType: fromPrismaWorkType(row.workType),
		weight: row.weight as 1 | 2 | 3,
		importance: row.importance as 1 | 2 | 3,
		urgency: row.urgency as 1 | 2 | 3,
		effortMinutes: row.effortMinutes,
		commitmentHorizon: fromPrismaCommitmentHorizon(row.commitmentHorizon),
		sortOrder: row.sortOrder,
		resumeNote: row.resumeNote,
		personaPresetId: row.personaPresetId,
		isDailyStanding: row.isDailyStanding,
		doneForToday: options?.doneForToday ?? false,
	};
}
