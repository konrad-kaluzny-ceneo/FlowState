import type { CommitmentHorizon } from "~/lib/domain/commitment-horizon";
import type { WorkType } from "~/lib/domain/work-type";

export type DomainTaskId = string | number;

export type { CommitmentHorizon };

export function defaultEisenhowerFields(weight: 1 | 2 | 3 = 2): {
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	personaPresetId: null;
	isDailyStanding: false;
} {
	return {
		importance: 2,
		urgency: weight,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		personaPresetId: null,
		isDailyStanding: false,
	};
}

export type DomainTaskStatus =
	| "active"
	| "completed"
	| "archived"
	| "planned"
	| "blocked";

export type DomainTask = {
	id: DomainTaskId;
	title: string;
	status: DomainTaskStatus;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
	archivedAt: Date | null;
	workType: WorkType;
	weight: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	sortOrder: number;
	resumeNote: string | null;
	project: string | null;
	personaPresetId: string | null;
	isDailyStanding: boolean;
	doneForToday?: boolean;
};

export type DomainActiveCycle = {
	id: DomainTaskId;
	sessionId: DomainTaskId;
	userId: string;
	taskId: DomainTaskId | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "RUNNING" | "PAUSED" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
	pausedAt?: Date | null;
	remainingDurationSec?: number | null;
	task: { id: DomainTaskId; title: string } | null;
};

export type DomainSession = {
	id: DomainTaskId;
	userId: string;
	state: "ACTIVE" | "ENDED_BY_USER" | "ENDED_BY_TIMEOUT";
	startedAt: Date;
	endedAt: Date | null;
	lastActivityAt: Date;
	interruptionCount: number;
	closureLine?: string | null;
	lastFocusedTaskId?: string | null;
};

export type DataMode = "guest" | "authenticated";

export type FocusedTask = { id: DomainTaskId; title: string } | null;

export type EisenhowerTaskInput = {
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: CommitmentHorizon;
	personaPresetId?: string | null;
	isDailyStanding?: boolean;
};

export interface TaskRepository {
	list(): Promise<DomainTask[]>;
	create(
		input: {
			title: string;
			workType?: WorkType;
			weight?: 1 | 2 | 3;
			resumeNote?: string | null;
			project?: string | null;
		} & EisenhowerTaskInput,
	): Promise<DomainTask>;
	update(
		input: {
			id: DomainTaskId;
			title?: string;
			status?: "active" | "completed" | "planned" | "blocked";
			workType?: WorkType;
			weight?: 1 | 2 | 3;
			resumeNote?: string | null;
			project?: string | null;
		} & EisenhowerTaskInput,
	): Promise<void>;
	delete(input: { id: DomainTaskId }): Promise<void>;
	reorder(input: { orderedIds: DomainTaskId[] }): Promise<void>;
	markDoneForToday(input: {
		id: DomainTaskId;
		localDateKey: string;
	}): Promise<void>;
	listArchived(): Promise<DomainTask[]>;
	restore(input: { id: DomainTaskId }): Promise<DomainTask>;
	deleteArchived(input: {
		ids: DomainTaskId[];
	}): Promise<{ deletedCount: number }>;
}

export interface CycleRepository {
	getActive(): Promise<DomainActiveCycle | null>;
	create(input: {
		kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
		configuredDurationSec: number;
		taskId?: DomainTaskId;
		intention?: string | null;
	}): Promise<
		Omit<DomainActiveCycle, "task"> & { task?: DomainActiveCycle["task"] }
	>;
	complete(input: {
		cycleId: DomainTaskId;
		markTaskDone?: boolean;
		incrementInterruption?: boolean;
		localDateKey?: string;
	}): Promise<void>;
	interrupt(input: { cycleId: DomainTaskId }): Promise<void>;
	pause(input: {
		cycleId: DomainTaskId;
		remainingDurationSec: number;
	}): Promise<DomainActiveCycle>;
	resume(input: { cycleId: DomainTaskId }): Promise<DomainActiveCycle>;
}

export interface SessionRepository {
	getOrCreateActive(): Promise<DomainSession>;
	end(input?: {
		closureLine?: string | null;
		lastFocusedTaskId?: DomainTaskId | null;
	}): Promise<DomainSession>;
}

export type Repositories = {
	mode: DataMode;
	tasks: TaskRepository;
	cycles: CycleRepository;
	sessions: SessionRepository;
};
