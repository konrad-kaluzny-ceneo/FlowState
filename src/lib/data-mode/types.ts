export type DomainTaskId = string | number;

export type CommitmentHorizon = "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";

export function defaultEisenhowerFields(weight: 1 | 2 | 3 = 2): {
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
} {
	return {
		importance: 2,
		urgency: weight,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
	};
}

export type DomainTask = {
	id: DomainTaskId;
	title: string;
	status: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	sortOrder: number;
};

export type DomainActiveCycle = {
	id: DomainTaskId;
	sessionId: DomainTaskId;
	userId: string;
	taskId: DomainTaskId | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "RUNNING" | "COMPLETED" | "INTERRUPTED";
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
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
};

export type DataMode = "guest" | "authenticated";

export type FocusedTask = { id: DomainTaskId; title: string } | null;

export type EisenhowerTaskInput = {
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: CommitmentHorizon;
};

export interface TaskRepository {
	list(): Promise<DomainTask[]>;
	create(
		input: {
			title: string;
			workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
			weight?: 1 | 2 | 3;
		} & EisenhowerTaskInput,
	): Promise<DomainTask>;
	update(
		input: {
			id: DomainTaskId;
			title?: string;
			status?: "active" | "completed";
			workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
			weight?: 1 | 2 | 3;
		} & EisenhowerTaskInput,
	): Promise<void>;
	delete(input: { id: DomainTaskId }): Promise<void>;
	reorder(input: { orderedIds: DomainTaskId[] }): Promise<void>;
}

export interface CycleRepository {
	getActive(): Promise<DomainActiveCycle | null>;
	create(input: {
		kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
		configuredDurationSec: number;
		taskId?: DomainTaskId;
	}): Promise<
		Omit<DomainActiveCycle, "task"> & { task?: DomainActiveCycle["task"] }
	>;
	complete(input: {
		cycleId: DomainTaskId;
		markTaskDone?: boolean;
		incrementInterruption?: boolean;
	}): Promise<void>;
	interrupt(input: { cycleId: DomainTaskId }): Promise<void>;
	rebindTask(input: {
		cycleId: DomainTaskId;
		taskId: DomainTaskId;
	}): Promise<DomainActiveCycle>;
}

export interface SessionRepository {
	getOrCreateActive(): Promise<DomainSession>;
	end(): Promise<DomainSession>;
}

export type Repositories = {
	mode: DataMode;
	tasks: TaskRepository;
	cycles: CycleRepository;
	sessions: SessionRepository;
};
