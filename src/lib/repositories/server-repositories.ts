import type {
	CycleRepository,
	DomainActiveCycle,
	DomainSession,
	DomainTask,
	DomainTaskId,
	SessionRepository,
	TaskRepository,
} from "~/lib/data-mode/types";

function toNumericId(id: DomainTaskId): number {
	const num = Number(id);
	if (!Number.isFinite(num)) {
		throw new Error(`Invalid numeric ID: ${String(id)}`);
	}
	return num;
}

type CreateTaskInput = {
	title: string;
	workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	resumeNote?: string | null;
	personaPresetId?: string | null;
};

type UpdateTaskInput = {
	id: number;
	title?: string;
	status?: "active" | "completed";
	workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight?: 1 | 2 | 3;
	importance?: 1 | 2 | 3;
	urgency?: 1 | 2 | 3;
	effortMinutes?: number | null;
	commitmentHorizon?: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	resumeNote?: string | null;
	personaPresetId?: string | null;
};

type CreateCycleInput = {
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	configuredDurationSec: number;
	taskId?: number;
	intention?: string;
};

type TrpcTaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance?: number;
	urgency?: number;
	effortMinutes?: number | null;
	commitmentHorizon?: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	resumeNote?: string | null;
	personaPresetId?: string | null;
	createdAt: Date;
	updatedAt: Date | null;
};

type TrpcClient = {
	task: {
		list: { fetch: () => Promise<TrpcTaskRow[]> };
		create: { mutate: (input: CreateTaskInput) => Promise<TrpcTaskRow> };
		update: { mutate: (input: UpdateTaskInput) => Promise<void> };
		delete: { mutate: (input: { id: number }) => Promise<void> };
		reorder: { mutate: (input: { orderedIds: number[] }) => Promise<void> };
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
				incrementInterruption?: boolean;
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
		rebindTask: {
			mutate: (input: {
				cycleId: number;
				taskId: number;
			}) => Promise<DomainActiveCycle>;
		};
	};
	session: {
		getOrCreateActive: { mutate: () => Promise<DomainSession> };
		end: {
			mutate: (input: { closureLine?: string }) => Promise<DomainSession>;
		};
	};
};

function toDomainTask(row: TrpcTaskRow): DomainTask {
	const urgency = (row.urgency ?? row.weight) as 1 | 2 | 3;
	return {
		...row,
		weight: row.weight as 1 | 2 | 3,
		importance: (row.importance ?? 2) as 1 | 2 | 3,
		urgency,
		effortMinutes: row.effortMinutes ?? null,
		commitmentHorizon: row.commitmentHorizon ?? "WHEN_POSSIBLE",
		resumeNote: row.resumeNote ?? null,
		personaPresetId: row.personaPresetId ?? null,
	};
}

export function createServerTaskRepository(client: TrpcClient): TaskRepository {
	return {
		list: async () => (await client.task.list.fetch()).map(toDomainTask),
		create: async (input) =>
			toDomainTask(await client.task.create.mutate(input)),
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
				incrementInterruption: input.incrementInterruption,
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
		rebindTask: (input) =>
			client.cycle.rebindTask.mutate({
				cycleId: toNumericId(input.cycleId),
				taskId: toNumericId(input.taskId),
			}),
	};
}

export function createServerSessionRepository(
	client: TrpcClient,
): SessionRepository {
	return {
		getOrCreateActive: () => client.session.getOrCreateActive.mutate(),
		end: (input?: { closureLine?: string | null }) =>
			client.session.end.mutate({
				closureLine: input?.closureLine ?? undefined,
			}),
	};
}
