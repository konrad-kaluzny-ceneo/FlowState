import type {
	CommitmentHorizon,
	CycleRepository,
	DomainActiveCycle,
	DomainSession,
	DomainTask,
	DomainTaskId,
	SessionRepository,
	TaskRepository,
} from "~/lib/data-mode/types";
import type { WorkType } from "~/lib/domain/work-type";

function toNumericId(id: DomainTaskId): number {
	const num = Number(id);
	if (!Number.isFinite(num)) {
		throw new Error(`Invalid numeric ID: ${String(id)}`);
	}
	return num;
}

type CreateTaskInput = {
	title: string;
	workType?: WorkType;
	weight?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: CommitmentHorizon;
	resumeNote?: string | null;
	project?: string | null;
	personaPresetId?: string | null;
	isDailyStanding?: boolean;
};

type UpdateTaskInput = {
	id: number;
	title?: string;
	status?: "active" | "completed" | "planned" | "blocked";
	workType?: WorkType;
	weight?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: CommitmentHorizon;
	resumeNote?: string | null;
	project?: string | null;
	personaPresetId?: string | null;
	isDailyStanding?: boolean;
};

type CreateCycleInput = {
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	configuredDurationSec: number;
	taskId?: number;
	intention?: string;
};

type ServerSessionRow = {
	id: number;
	userId: string;
	state: DomainSession["state"];
	closureLine: string | null;
	lastFocusedTaskId: number | null;
	startedAt: Date;
	endedAt: Date | null;
	lastActivityAt: Date;
	interruptionCount: number;
	archivedAt?: Date | null;
};

type TrpcClient = {
	task: {
		list: { fetch: () => Promise<DomainTask[]> };
		create: { mutate: (input: CreateTaskInput) => Promise<DomainTask> };
		update: { mutate: (input: UpdateTaskInput) => Promise<void> };
		delete: { mutate: (input: { id: number }) => Promise<void> };
		reorder: { mutate: (input: { orderedIds: number[] }) => Promise<void> };
		archiveList: { fetch: () => Promise<DomainTask[]> };
		restore: { mutate: (input: { id: number }) => Promise<DomainTask> };
		deleteArchived: {
			mutate: (input: { ids: number[] }) => Promise<{ deletedCount: number }>;
		};
	};
	cycle: {
		getActive: { fetch: () => Promise<DomainActiveCycle | null> };
		create: {
			mutate: (
				input: CreateCycleInput,
			) => Promise<Omit<DomainActiveCycle, "task">>;
		};
		complete: {
			mutate: (input: {
				cycleId: number;
				markTaskDone?: boolean;
				markTaskBlocked?: boolean;
				incrementInterruption?: boolean;
				localDateKey?: string;
			}) => Promise<unknown>;
		};
		interrupt: { mutate: (input: { cycleId: number }) => Promise<unknown> };
		pause: {
			mutate: (input: {
				cycleId: number;
				remainingDurationSec: number;
			}) => Promise<DomainActiveCycle>;
		};
		resume: {
			mutate: (input: { cycleId: number }) => Promise<DomainActiveCycle>;
		};
	};
	session: {
		getOrCreateActive: { mutate: () => Promise<ServerSessionRow> };
		end: {
			mutate: (input: {
				closureLine?: string;
				lastFocusedTaskId?: number;
			}) => Promise<ServerSessionRow>;
		};
	};
};

function normalizeDomainTask(task: DomainTask): DomainTask {
	return {
		...task,
		weight: task.weight as 1 | 2 | 3,
		importance: task.importance as 1 | 2 | 3,
		urgency: task.urgency as 1 | 2 | 3,
	};
}

export function createServerTaskRepository(client: TrpcClient): TaskRepository {
	return {
		list: async () =>
			(await client.task.list.fetch()).map((task) => normalizeDomainTask(task)),
		create: async (input) =>
			normalizeDomainTask(await client.task.create.mutate(input)),
		update: (input) =>
			client.task.update.mutate({
				...input,
				id: toNumericId(input.id),
			}),
		delete: (input) => client.task.delete.mutate({ id: toNumericId(input.id) }),
		reorder: (input) =>
			client.task.reorder.mutate({
				orderedIds: input.orderedIds.map(toNumericId),
			}),
		markDoneForToday: async (_input) => {
			throw new Error(
				"markDoneForToday is not supported via server repository",
			);
		},
		listArchived: async () =>
			(await client.task.archiveList.fetch()).map((task) =>
				normalizeDomainTask(task),
			),
		restore: async (input) =>
			normalizeDomainTask(
				await client.task.restore.mutate({ id: toNumericId(input.id) }),
			),
		deleteArchived: async (input) =>
			client.task.deleteArchived.mutate({
				ids: input.ids.map(toNumericId),
			}),
	};
}

export function createServerCycleRepository(
	client: TrpcClient,
): CycleRepository {
	return {
		getActive: () => client.cycle.getActive.fetch(),
		create: (input) =>
			client.cycle.create.mutate({
				kind: input.kind,
				configuredDurationSec: input.configuredDurationSec,
				taskId: input.taskId != null ? toNumericId(input.taskId) : undefined,
				...(input.intention != null ? { intention: input.intention } : {}),
			}),
		complete: async (input) => {
			await client.cycle.complete.mutate({
				cycleId: toNumericId(input.cycleId),
				markTaskDone: input.markTaskDone,
				markTaskBlocked: input.markTaskBlocked,
				incrementInterruption: input.incrementInterruption,
				...(input.localDateKey != null
					? { localDateKey: input.localDateKey }
					: {}),
			});
		},
		interrupt: async (input) => {
			await client.cycle.interrupt.mutate({
				cycleId: toNumericId(input.cycleId),
			});
		},
		pause: async (input) => {
			const cycle = await client.cycle.pause.mutate({
				cycleId: toNumericId(input.cycleId),
				remainingDurationSec: input.remainingDurationSec,
			});
			return cycle;
		},
		resume: async (input) => {
			const cycle = await client.cycle.resume.mutate({
				cycleId: toNumericId(input.cycleId),
			});
			return cycle;
		},
	};
}

function normalizeDomainSession(session: ServerSessionRow): DomainSession {
	return {
		id: session.id,
		userId: session.userId,
		state: session.state,
		startedAt: session.startedAt,
		endedAt: session.endedAt,
		lastActivityAt: session.lastActivityAt,
		interruptionCount: session.interruptionCount,
		closureLine: session.closureLine,
		lastFocusedTaskId:
			session.lastFocusedTaskId != null
				? String(session.lastFocusedTaskId)
				: null,
	};
}

export function createServerSessionRepository(
	client: TrpcClient,
): SessionRepository {
	return {
		getOrCreateActive: async () =>
			normalizeDomainSession(await client.session.getOrCreateActive.mutate()),
		end: async (input?: {
			closureLine?: string | null;
			lastFocusedTaskId?: DomainTaskId | null;
		}) =>
			normalizeDomainSession(
				await client.session.end.mutate({
					closureLine: input?.closureLine ?? undefined,
					lastFocusedTaskId:
						input?.lastFocusedTaskId != null
							? toNumericId(input.lastFocusedTaskId)
							: undefined,
				}),
			),
	};
}
