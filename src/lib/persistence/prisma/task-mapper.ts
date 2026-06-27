import type { Task as PrismaTask } from "@prisma/generated";

import type { DomainTask, DomainTaskStatus } from "~/lib/data-mode/types";
import {
	fromPrismaCommitmentHorizon,
	fromPrismaWorkType,
} from "~/lib/persistence/prisma/enum-mappers";

const DOMAIN_TASK_STATUSES: readonly DomainTaskStatus[] = [
	"active",
	"completed",
	"archived",
];

// Task.status is a free-form String column, so validate it at the persistence
// boundary instead of casting unknown DB values into a trusted DomainTaskStatus.
function toDomainTaskStatus(status: string): DomainTaskStatus {
	if ((DOMAIN_TASK_STATUSES as readonly string[]).includes(status)) {
		return status as DomainTaskStatus;
	}
	if (process.env.NODE_ENV !== "production") {
		throw new Error(`Unexpected task status from database: ${status}`);
	}
	return "active";
}

export function mapTaskFromPrisma(
	row: PrismaTask,
	options?: { doneForToday?: boolean },
): DomainTask {
	return {
		id: row.id,
		title: row.title,
		status: toDomainTaskStatus(row.status),
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
		archivedAt: row.archivedAt,
		doneForToday: options?.doneForToday ?? false,
	};
}
