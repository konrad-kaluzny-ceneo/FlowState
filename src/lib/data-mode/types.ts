export type DomainTaskId = string | number;

export type DomainTask = {
	id: DomainTaskId;
	title: string;
	status: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
	workType: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight: 1 | 2 | 3;
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

export interface TaskRepository {
	list(): Promise<DomainTask[]>;
	create(input: {
		title: string;
		workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE";
		weight?: 1 | 2 | 3;
	}): Promise<DomainTask>;
	update(input: {
		id: DomainTaskId;
		title?: string;
		status?: "active" | "completed";
		workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE";
		weight?: 1 | 2 | 3;
	}): Promise<void>;
	delete(input: { id: DomainTaskId }): Promise<void>;
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
	}): Promise<void>;
	interrupt(input: { cycleId: DomainTaskId }): Promise<void>;
}

export interface SessionRepository {
	getOrCreateActive(): Promise<DomainSession>;
}

export type Repositories = {
	mode: DataMode;
	tasks: TaskRepository;
	cycles: CycleRepository;
	sessions: SessionRepository;
};
