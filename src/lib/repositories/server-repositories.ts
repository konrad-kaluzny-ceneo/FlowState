import type {
	CycleRepository,
	DomainActiveCycle,
	DomainSession,
	DomainTask,
	SessionRepository,
	TaskRepository,
} from "~/lib/data-mode/types";

type CreateTaskInput = {
	title: string;
	workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight?: 1 | 2 | 3;
};

type UpdateTaskInput = {
	id: number;
	title?: string;
	status?: "active" | "completed";
	workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight?: 1 | 2 | 3;
};

type CreateCycleInput = {
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	configuredDurationSec: number;
	taskId?: number;
};

type TrpcTaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
	workType: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight: number;
	createdAt: Date;
	updatedAt: Date | null;
};

type TrpcClient = {
	task: {
		list: { fetch: () => Promise<TrpcTaskRow[]> };
		create: { mutate: (input: CreateTaskInput) => Promise<TrpcTaskRow> };
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
	};
};

function toDomainTask(row: TrpcTaskRow): DomainTask {
	return { ...row, weight: row.weight as 1 | 2 | 3 };
}

export function createServerTaskRepository(client: TrpcClient): TaskRepository {
	return {
		list: async () => (await client.task.list.fetch()).map(toDomainTask),
		create: async (input) => toDomainTask(await client.task.create.mutate(input)),
		update: (input) =>
			client.task.update.mutate({
				...input,
				id: Number(input.id),
			}),
		delete: (input) => client.task.delete.mutate({ id: Number(input.id) }),
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
				taskId: input.taskId != null ? Number(input.taskId) : undefined,
			}),
		complete: async (input) => {
			await client.cycle.complete.mutate({
				cycleId: Number(input.cycleId),
				markTaskDone: input.markTaskDone,
			});
		},
		interrupt: async (input) => {
			await client.cycle.interrupt.mutate({ cycleId: Number(input.cycleId) });
		},
	};
}

export function createServerSessionRepository(
	client: TrpcClient,
): SessionRepository {
	return {
		getOrCreateActive: () => client.session.getOrCreateActive.mutate(),
	};
}
