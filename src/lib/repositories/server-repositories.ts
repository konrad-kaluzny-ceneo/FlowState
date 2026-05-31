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
	workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight?: number;
};

type UpdateTaskInput = {
	id: number;
	title?: string;
	status?: "active" | "completed";
};

type CreateCycleInput = {
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	configuredDurationSec: number;
	taskId?: number;
};

type TrpcClient = {
	task: {
		list: { fetch: () => Promise<DomainTask[]> };
		create: { mutate: (input: CreateTaskInput) => Promise<DomainTask> };
		update: { mutate: (input: UpdateTaskInput) => Promise<void> };
		delete: { mutate: (input: { id: number }) => Promise<void> };
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
			}) => Promise<unknown>;
		};
		interrupt: { mutate: (input: { cycleId: number }) => Promise<unknown> };
	};
	session: {
		getOrCreateActive: { mutate: () => Promise<DomainSession> };
		end: { mutate: () => Promise<DomainSession> };
	};
};

export function createServerTaskRepository(client: TrpcClient): TaskRepository {
	return {
		list: () => client.task.list.fetch(),
		create: (input) => client.task.create.mutate(input),
		update: (input) =>
			client.task.update.mutate({
				...input,
				id: toNumericId(input.id),
			}),
		delete: (input) => client.task.delete.mutate({ id: toNumericId(input.id) }),
	};
}

export function createServerCycleRepository(
	client: TrpcClient,
): CycleRepository {
	return {
		getActive: () => client.cycle.getActive.fetch(),
		create: (input) =>
			client.cycle.create.mutate({
				...input,
				taskId: input.taskId != null ? toNumericId(input.taskId) : undefined,
			}),
		complete: async (input) => {
			await client.cycle.complete.mutate({
				cycleId: toNumericId(input.cycleId),
				markTaskDone: input.markTaskDone,
			});
		},
		interrupt: async (input) => {
			await client.cycle.interrupt.mutate({
				cycleId: toNumericId(input.cycleId),
			});
		},
	};
}

export function createServerSessionRepository(
	client: TrpcClient,
): SessionRepository {
	return {
		getOrCreateActive: () => client.session.getOrCreateActive.mutate(),
		end: () => client.session.end.mutate(),
	};
}
