import type {
	CycleRepository,
	DomainActiveCycle,
	DomainTask,
	SessionRepository,
	TaskRepository,
} from "~/lib/data-mode/types";
import { loadSnapshot, mutateSnapshot } from "~/lib/guest/store";

const GUEST_USER_ID = "guest";

function newGuestId(): string {
	return crypto.randomUUID();
}

function toDomainTask(task: {
	id: string;
	title: string;
	status: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance: 1 | 2 | 3;
	urgency: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	resumeNote: string | null;
	createdAt: Date;
	updatedAt: Date | null;
}): DomainTask {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		userId: GUEST_USER_ID,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
		workType: task.workType,
		weight: task.weight as 1 | 2 | 3,
		importance: task.importance,
		urgency: task.urgency,
		effortMinutes: task.effortMinutes,
		commitmentHorizon: task.commitmentHorizon,
		sortOrder: task.sortOrder,
		resumeNote: task.resumeNote ?? null,
	};
}

function toDomainCycle(
	cycle: {
		id: string;
		sessionId: string;
		taskId: string | null;
		kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
		state: "RUNNING" | "COMPLETED" | "INTERRUPTED";
		configuredDurationSec: number;
		startedAt: Date;
		endedAt: Date | null;
	},
	snapshot: ReturnType<typeof loadSnapshot>,
): DomainActiveCycle {
	const task =
		cycle.taskId != null
			? (snapshot.tasks.find((t) => t.id === cycle.taskId) ?? null)
			: null;

	return {
		id: cycle.id,
		sessionId: cycle.sessionId,
		userId: GUEST_USER_ID,
		taskId: cycle.taskId,
		kind: cycle.kind,
		state: cycle.state,
		configuredDurationSec: cycle.configuredDurationSec,
		startedAt: cycle.startedAt,
		endedAt: cycle.endedAt,
		task: task != null ? { id: task.id, title: task.title } : null,
	};
}

function sortTasksByOrder<T extends { sortOrder: number; createdAt: Date }>(
	tasks: T[],
): T[] {
	return [...tasks].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}
		return a.createdAt.getTime() - b.createdAt.getTime();
	});
}

export function createGuestTaskRepository(): TaskRepository {
	return {
		async list() {
			return sortTasksByOrder(loadSnapshot().tasks).map(toDomainTask);
		},

		async create(input) {
			const snapshot = loadSnapshot();
			const now = new Date();
			const rawWeight = input.weight ?? 2;
			const urgency = Math.min(3, Math.max(1, input.urgency ?? rawWeight)) as
				| 1
				| 2
				| 3;
			const importance = Math.min(3, Math.max(1, input.importance ?? 2)) as
				| 1
				| 2
				| 3;
			const maxSortOrder = snapshot.tasks
				.filter((task) => task.status === "active")
				.reduce((max, task) => Math.max(max, task.sortOrder), -1);
			const task = {
				id: newGuestId(),
				title: input.title,
				status: "active" as const,
				workType: input.workType ?? "OPERATIONAL",
				weight: urgency,
				importance,
				urgency,
				effortMinutes: input.effortMinutes ?? null,
				commitmentHorizon: input.commitmentHorizon ?? "WHEN_POSSIBLE",
				sortOrder: maxSortOrder + 1,
				resumeNote: input.resumeNote ?? null,
				createdAt: now,
				updatedAt: null,
			};

			const { error } = mutateSnapshot((snapshot) => ({
				...snapshot,
				tasks: [...snapshot.tasks, task],
			}));

			if (error != null) {
				throw new Error(error);
			}

			return toDomainTask(task);
		},

		async update(input) {
			const { error } = mutateSnapshot((snapshot) => ({
				...snapshot,
				tasks: snapshot.tasks.map((task) => {
					if (task.id !== input.id) {
						return task;
					}

					const wasCompleted = task.status === "completed";
					const becomingActive = input.status === "active";
					let sortOrder = task.sortOrder;
					if (wasCompleted && becomingActive) {
						const maxActiveSortOrder = snapshot.tasks
							.filter((t) => t.status === "active")
							.reduce((max, t) => Math.max(max, t.sortOrder), -1);
						sortOrder = maxActiveSortOrder + 1;
					}

					const nextUrgency =
						input.urgency != null
							? (Math.min(3, Math.max(1, input.urgency)) as 1 | 2 | 3)
							: input.weight != null
								? (Math.min(3, Math.max(1, input.weight)) as 1 | 2 | 3)
								: null;

					const nextStatus = input.status ?? task.status;

					return {
						...task,
						...(input.title != null ? { title: input.title } : {}),
						...(input.status != null ? { status: input.status } : {}),
						...(input.workType != null ? { workType: input.workType } : {}),
						...(input.importance != null
							? {
									importance: Math.min(3, Math.max(1, input.importance)) as
										| 1
										| 2
										| 3,
								}
							: {}),
						...(nextUrgency != null
							? { weight: nextUrgency, urgency: nextUrgency }
							: {}),
						...(input.effortMinutes !== undefined
							? { effortMinutes: input.effortMinutes }
							: {}),
						...(input.commitmentHorizon != null
							? { commitmentHorizon: input.commitmentHorizon }
							: {}),
						...(input.resumeNote !== undefined
							? { resumeNote: input.resumeNote }
							: {}),
						...(nextStatus === "completed" ? { resumeNote: null } : {}),
						sortOrder,
						updatedAt: new Date(),
					};
				}),
			}));

			if (error != null) {
				throw new Error(error);
			}
		},

		async delete(input) {
			const { error } = mutateSnapshot((snapshot) => ({
				...snapshot,
				tasks: snapshot.tasks.filter((task) => task.id !== input.id),
			}));

			if (error != null) {
				throw new Error(error);
			}
		},

		async reorder(input) {
			const { error } = mutateSnapshot((snapshot) => {
				const activeTasks = snapshot.tasks.filter(
					(task) => task.status === "active",
				);
				const activeIds = new Set(activeTasks.map((task) => task.id));

				if (input.orderedIds.length !== activeTasks.length) {
					throw new Error("Invalid reorder");
				}

				const orderedSet = new Set(input.orderedIds.map(String));
				if (orderedSet.size !== input.orderedIds.length) {
					throw new Error("Invalid reorder");
				}

				for (const id of input.orderedIds) {
					if (!activeIds.has(String(id))) {
						throw new Error("Task not found or not active");
					}
				}

				const sortOrderById = new Map(
					input.orderedIds.map((id, index) => [String(id), index]),
				);
				const now = new Date();

				return {
					...snapshot,
					tasks: snapshot.tasks.map((task) => {
						const newSortOrder = sortOrderById.get(task.id);
						if (newSortOrder !== undefined) {
							return { ...task, sortOrder: newSortOrder, updatedAt: now };
						}
						return task;
					}),
				};
			});

			if (error != null) {
				throw new Error(error);
			}
		},
	};
}

export function createGuestSessionRepository(): SessionRepository {
	return {
		async getOrCreateActive() {
			const snapshot = loadSnapshot();
			const active = snapshot.sessions.find((s) => s.state === "ACTIVE");

			if (active != null) {
				return {
					id: active.id,
					userId: GUEST_USER_ID,
					state: active.state,
					startedAt: active.startedAt,
					endedAt: active.endedAt,
					lastActivityAt: active.lastActivityAt,
					interruptionCount: active.interruptionCount,
				};
			}

			const now = new Date();
			const session = {
				id: newGuestId(),
				state: "ACTIVE" as const,
				startedAt: now,
				endedAt: null,
				lastActivityAt: now,
				interruptionCount: 0,
			};

			const { error } = mutateSnapshot((current) => ({
				...current,
				sessions: [...current.sessions, session],
			}));

			if (error != null) {
				throw new Error(error);
			}

			return {
				id: session.id,
				userId: GUEST_USER_ID,
				state: session.state,
				startedAt: session.startedAt,
				endedAt: session.endedAt,
				lastActivityAt: session.lastActivityAt,
				interruptionCount: session.interruptionCount,
			};
		},

		async end() {
			const snapshot = loadSnapshot();
			const active = snapshot.sessions.find((s) => s.state === "ACTIVE");

			if (active == null) {
				throw new Error("No active session to end");
			}

			const now = new Date();
			const { error } = mutateSnapshot((current) => ({
				...current,
				sessions: current.sessions.map((s) =>
					s.id === active.id
						? { ...s, state: "ENDED_BY_USER" as const, endedAt: now }
						: s,
				),
			}));

			if (error != null) {
				throw new Error(error);
			}

			return {
				id: active.id,
				userId: GUEST_USER_ID,
				state: "ENDED_BY_USER" as const,
				startedAt: active.startedAt,
				endedAt: now,
				lastActivityAt: active.lastActivityAt,
				interruptionCount: active.interruptionCount,
			};
		},
	};
}

export function createGuestCycleRepository(): CycleRepository {
	return {
		async getActive() {
			const snapshot = loadSnapshot();
			const cycle = snapshot.cycles.find((c) => c.state === "RUNNING") ?? null;
			return cycle != null ? toDomainCycle(cycle, snapshot) : null;
		},

		async create(input) {
			await createGuestSessionRepository().getOrCreateActive();
			const snapshot = loadSnapshot();
			const session = snapshot.sessions.find((s) => s.state === "ACTIVE");

			if (session == null) {
				throw new Error("No active guest session");
			}

			const existingRunning = snapshot.cycles.find(
				(c) => c.state === "RUNNING",
			);
			if (existingRunning != null) {
				throw new Error("A cycle is already running");
			}

			const cycle = {
				id: newGuestId(),
				sessionId: session.id,
				taskId: input.taskId != null ? String(input.taskId) : null,
				kind: input.kind,
				state: "RUNNING" as const,
				configuredDurationSec: input.configuredDurationSec,
				startedAt: new Date(),
				endedAt: null,
			};

			const { error } = mutateSnapshot((current) => ({
				...current,
				cycles: [...current.cycles, cycle],
				sessions: current.sessions.map((s) =>
					s.id === session.id ? { ...s, lastActivityAt: new Date() } : s,
				),
			}));

			if (error != null) {
				throw new Error(error);
			}

			return toDomainCycle(cycle, loadSnapshot());
		},

		async complete(input) {
			const endedAt = new Date();
			const { error } = mutateSnapshot((snapshot) => {
				const cycle = snapshot.cycles.find((c) => c.id === input.cycleId);
				if (cycle == null || cycle.state !== "RUNNING") {
					throw new Error("Cycle is not running");
				}

				const tasks =
					input.markTaskDone && cycle.taskId != null
						? snapshot.tasks.map((task) =>
								task.id === cycle.taskId
									? {
											...task,
											status: "completed" as const,
											updatedAt: endedAt,
										}
									: task,
							)
						: snapshot.tasks;

				return {
					...snapshot,
					tasks,
					cycles: snapshot.cycles.map((c) =>
						c.id === input.cycleId
							? { ...c, state: "COMPLETED" as const, endedAt }
							: c,
					),
				};
			});

			if (error != null) {
				throw new Error(error);
			}
		},

		async interrupt(input) {
			const endedAt = new Date();
			const { error } = mutateSnapshot((snapshot) => {
				const cycle = snapshot.cycles.find((c) => c.id === input.cycleId);
				if (cycle == null || cycle.state !== "RUNNING") {
					throw new Error("Cycle is not running");
				}

				return {
					...snapshot,
					cycles: snapshot.cycles.map((c) =>
						c.id === input.cycleId
							? { ...c, state: "INTERRUPTED" as const, endedAt }
							: c,
					),
				};
			});

			if (error != null) {
				throw new Error(error);
			}
		},

		async rebindTask(input) {
			const { error } = mutateSnapshot((snapshot) => {
				const cycle = snapshot.cycles.find((c) => c.id === input.cycleId);
				if (
					cycle == null ||
					cycle.state !== "RUNNING" ||
					cycle.kind !== "WORK"
				) {
					throw new Error("Only a running work cycle can rebind its task");
				}

				const task = snapshot.tasks.find((t) => t.id === input.taskId);
				if (task == null) {
					throw new Error("Task not found");
				}

				return {
					...snapshot,
					cycles: snapshot.cycles.map((c) =>
						c.id === input.cycleId ? { ...c, taskId: String(input.taskId) } : c,
					),
				};
			});

			if (error != null) {
				throw new Error(error);
			}

			const snapshot = loadSnapshot();
			const cycle = snapshot.cycles.find((c) => c.id === input.cycleId);
			if (cycle == null) {
				throw new Error("Cycle not found");
			}

			return toDomainCycle(cycle, snapshot);
		},
	};
}

export function createGuestRepositories() {
	return {
		tasks: createGuestTaskRepository(),
		sessions: createGuestSessionRepository(),
		cycles: createGuestCycleRepository(),
	};
}
