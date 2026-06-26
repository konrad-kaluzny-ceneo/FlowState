import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure
 * Validates: Requirements 9.4, 9.5
 */

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	sortOrder: number;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance: number;
	urgency: number;
	effortMinutes: number | null;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	personaPresetId: string | null;
	isDailyStanding: boolean;
	createdAt: Date;
	updatedAt: Date | null;
};

type TaskDayCompletionRow = {
	userId: string;
	taskId: number;
	localDateKey: string;
};

// Stateful in-memory store; findFirst filters by { id, userId } like production
let allTasks: TaskRow[] = [];
let taskDayCompletions: TaskDayCompletionRow[] = [];
let nextTaskId = 1;

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

function filterTasks(args: {
	where?: {
		userId?: string;
		status?: string;
		id?: number;
	};
	select?: { id?: true };
	orderBy?: Array<{ sortOrder?: "asc" | "desc"; createdAt?: "asc" | "desc" }>;
}): TaskRow[] | Array<{ id: number }> {
	let rows = [...allTasks];

	if (args.where?.userId != null) {
		rows = rows.filter((t) => t.userId === args.where?.userId);
	}
	if (args.where?.status != null) {
		rows = rows.filter((t) => t.status === args.where?.status);
	}
	if (args.where?.id != null) {
		rows = rows.filter((t) => t.id === args.where?.id);
	}

	if (args.orderBy) {
		for (const clause of [...args.orderBy].reverse()) {
			if (clause.sortOrder != null) {
				const dir = clause.sortOrder === "asc" ? 1 : -1;
				rows.sort((a, b) => (a.sortOrder - b.sortOrder) * dir);
			}
			if (clause.createdAt != null) {
				const dir = clause.createdAt === "asc" ? 1 : -1;
				rows.sort(
					(a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * dir,
				);
			}
		}
	}

	if (args.select?.id) {
		return rows.map((t) => ({ id: t.id }));
	}

	return rows;
}

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	return {
		db: {
			task: {
				findMany: vi.fn((args: Parameters<typeof filterTasks>[0]) =>
					Promise.resolve(filterTasks(args)),
				),
				aggregate: vi.fn(
					(args: {
						where?: { userId?: string; status?: string };
						_max?: { sortOrder?: true };
					}) => {
						const rows = filterTasks({ where: args.where }) as TaskRow[];
						const maxSortOrder =
							rows.length === 0
								? null
								: Math.max(...rows.map((t) => t.sortOrder));
						return Promise.resolve({ _max: { sortOrder: maxSortOrder } });
					},
				),
				create: vi.fn((args: { data: Record<string, unknown> }) => {
					const urgency = Number(args.data.urgency ?? args.data.weight ?? 2);
					const row: TaskRow = {
						id: nextTaskId++,
						title: String(args.data.title),
						status: "active",
						userId: String(args.data.userId),
						sortOrder: Number(args.data.sortOrder ?? 0),
						workType:
							(args.data.workType as TaskRow["workType"]) ?? "OPERATIONAL",
						weight: Number(args.data.weight ?? urgency),
						importance: Number(args.data.importance ?? 2),
						urgency,
						effortMinutes:
							args.data.effortMinutes === undefined
								? null
								: (args.data.effortMinutes as number | null),
						commitmentHorizon:
							(args.data.commitmentHorizon as TaskRow["commitmentHorizon"]) ??
							"WHEN_POSSIBLE",
						personaPresetId:
							args.data.personaPresetId === undefined
								? null
								: (args.data.personaPresetId as string | null),
						isDailyStanding: Boolean(args.data.isDailyStanding ?? false),
						createdAt: new Date(),
						updatedAt: null,
					};
					allTasks.push(row);
					return Promise.resolve(row);
				}),
				findFirst: vi.fn(
					(args: { where?: { id?: number; userId?: string } }) => {
						return Promise.resolve(
							allTasks.find(
								(t) =>
									t.id === args?.where?.id && t.userId === args?.where?.userId,
							) ?? null,
						);
					},
				),
				update: vi.fn(
					(args: {
						where: { id: number };
						data: Partial<
							Pick<
								TaskRow,
								| "title"
								| "status"
								| "sortOrder"
								| "updatedAt"
								| "weight"
								| "urgency"
								| "importance"
								| "effortMinutes"
								| "commitmentHorizon"
								| "workType"
								| "personaPresetId"
								| "isDailyStanding"
							>
						>;
					}) => {
						const task = allTasks.find((t) => t.id === args.where.id);
						if (!task) {
							throw new Error("not found");
						}
						Object.assign(task, args.data);
						return Promise.resolve(task);
					},
				),
				delete: vi.fn((args: { where: { id: number } }) => {
					const idx = allTasks.findIndex((t) => t.id === args.where.id);
					if (idx >= 0) {
						allTasks.splice(idx, 1);
					}
					return Promise.resolve({ id: args.where.id });
				}),
			},
			taskDayCompletion: {
				findMany: vi.fn(
					(args: { where: { userId?: string; localDateKey?: string } }) => {
						return Promise.resolve(
							taskDayCompletions.filter((row) => {
								if (
									args.where.userId != null &&
									row.userId !== args.where.userId
								) {
									return false;
								}
								if (
									args.where.localDateKey != null &&
									row.localDateKey !== args.where.localDateKey
								) {
									return false;
								}
								return true;
							}),
						);
					},
				),
				upsert: vi.fn(
					(args: {
						where: {
							task_day_completion_user_task_date: {
								userId: string;
								taskId: number;
								localDateKey: string;
							};
						};
						create: TaskDayCompletionRow;
					}) => {
						const key = args.where.task_day_completion_user_task_date;
						const existing = taskDayCompletions.find(
							(row) =>
								row.userId === key.userId &&
								row.taskId === key.taskId &&
								row.localDateKey === key.localDateKey,
						);
						if (existing) {
							return Promise.resolve(existing);
						}
						taskDayCompletions.push(args.create);
						return Promise.resolve(args.create);
					},
				),
			},
			$transaction: vi.fn(
				async (ops: Array<Promise<unknown>> | ((tx: unknown) => unknown)) => {
					if (typeof ops === "function") {
						return ops((await import("~/server/db/index")).db);
					}
					return Promise.all(ops);
				},
			),
		},
	};
});

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(taskRouter);

const USER_A = "user-a";
const USER_B = "user-b";

function makeTask(
	partial: Partial<TaskRow> & Pick<TaskRow, "id" | "title" | "userId">,
): TaskRow {
	return {
		status: "active",
		sortOrder: 0,
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		personaPresetId: null,
		isDailyStanding: false,
		createdAt: new Date(),
		updatedAt: null,
		...partial,
	};
}

function taskCaller(userId: string) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: "test@example.com",
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.string({ minLength: 1, maxLength: 50 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for positive task IDs */
const taskIdArb = fc.integer({ min: 1, max: 100000 });

/** Arbitrary for valid task titles (1-256 chars, non-empty) */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 256 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.stringMatching(/^[a-z]{1,6}$/),
		fc.constantFrom("com", "org", "net"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/**
 * Arbitrary for ownership scenarios:
 * - ownerUserId: the user who owns the task
 * - callerUserId: the user attempting the mutation
 */
const ownershipScenarioArb = fc
	.tuple(userIdArb, userIdArb, fc.boolean())
	.map(([userId1, userId2, sameUser]) => {
		if (sameUser) {
			return { ownerUserId: userId1, callerUserId: userId1 };
		}
		// Ensure different users
		const callerUserId = userId1 === userId2 ? `${userId2}_other` : userId2;
		return { ownerUserId: userId1, callerUserId };
	});

describe("Feature: neon-auth, Property 11: Task mutation ownership with NOT_FOUND on failure", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		nextTaskId = 1;
	});

	fcTest.prop([ownershipScenarioArb, taskIdArb, taskTitleArb, emailArb], {
		numRuns: 100,
	})(
		"update succeeds only when userId matches, returns NOT_FOUND otherwise",
		async (scenario, taskId, title, email) => {
			const isOwner = scenario.ownerUserId === scenario.callerUserId;

			// Seed task owned by ownerUserId; findFirst with caller's userId only matches when owner === caller
			allTasks = [
				makeTask({
					id: taskId,
					title: "Original",
					userId: scenario.ownerUserId,
				}),
			];

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: scenario.callerUserId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			if (isOwner) {
				await expect(
					caller.update({ id: taskId, title }),
				).resolves.not.toThrow();
			} else {
				await expect(caller.update({ id: taskId, title })).rejects.toThrow(
					expect.objectContaining({
						code: "NOT_FOUND",
					}),
				);
			}
		},
	);

	fcTest.prop([ownershipScenarioArb, taskIdArb, emailArb], { numRuns: 100 })(
		"delete succeeds only when userId matches, returns NOT_FOUND otherwise",
		async (scenario, taskId, email) => {
			const isOwner = scenario.ownerUserId === scenario.callerUserId;

			allTasks = [
				makeTask({
					id: taskId,
					title: "Task",
					userId: scenario.ownerUserId,
				}),
			];

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: scenario.callerUserId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			if (isOwner) {
				await expect(caller.delete({ id: taskId })).resolves.not.toThrow();
			} else {
				await expect(caller.delete({ id: taskId })).rejects.toThrow(
					expect.objectContaining({
						code: "NOT_FOUND",
					}),
				);
			}
		},
	);
});

describe("task reorder and sortOrder", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		nextTaskId = 1;
		vi.clearAllMocks();
	});

	it("owner reorders active tasks and list reflects new order", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "First",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
			}),
			makeTask({
				id: 2,
				title: "Second",
				userId: USER_A,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 2),
			}),
			makeTask({
				id: 3,
				title: "Third",
				userId: USER_A,
				sortOrder: 2,
				createdAt: new Date(2024, 0, 3),
			}),
		];

		await taskCaller(USER_A).reorder({ orderedIds: [3, 1, 2] });

		const list = await taskCaller(USER_A).list();
		expect(list.map((t) => t.id)).toEqual([3, 1, 2]);
		expect(list.map((t) => t.sortOrder)).toEqual([0, 1, 2]);
	});

	it("cross-user ID in orderedIds throws NOT_FOUND", async () => {
		allTasks = [
			makeTask({ id: 1, title: "A first", userId: USER_A, sortOrder: 0 }),
			makeTask({ id: 2, title: "B task", userId: USER_B, sortOrder: 0 }),
			makeTask({ id: 3, title: "A second", userId: USER_A, sortOrder: 1 }),
		];

		await expect(
			taskCaller(USER_A).reorder({ orderedIds: [3, 2] }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("completed task ID in orderedIds throws BAD_REQUEST", async () => {
		allTasks = [
			makeTask({ id: 1, title: "Active", userId: USER_A, sortOrder: 0 }),
			makeTask({
				id: 2,
				title: "Done",
				userId: USER_A,
				status: "completed",
				sortOrder: 1,
			}),
		];

		await expect(
			taskCaller(USER_A).reorder({ orderedIds: [2, 1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("non-permutation input throws BAD_REQUEST", async () => {
		allTasks = [
			makeTask({ id: 1, title: "One", userId: USER_A, sortOrder: 0 }),
			makeTask({ id: 2, title: "Two", userId: USER_A, sortOrder: 1 }),
		];

		await expect(
			taskCaller(USER_A).reorder({ orderedIds: [1, 1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		await expect(
			taskCaller(USER_A).reorder({ orderedIds: [1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("revert completed to active assigns tail sortOrder", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Active A",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
			}),
			makeTask({
				id: 2,
				title: "Active B",
				userId: USER_A,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 2),
			}),
			makeTask({
				id: 3,
				title: "Completed",
				userId: USER_A,
				status: "completed",
				sortOrder: 0,
				createdAt: new Date(2024, 0, 3),
			}),
		];

		await taskCaller(USER_A).update({ id: 3, status: "active" });

		const reverted = allTasks.find((t) => t.id === 3);
		expect(reverted?.status).toBe("active");
		expect(reverted?.sortOrder).toBe(2);

		const list = await taskCaller(USER_A).list();
		expect(list.map((t) => t.id)).toEqual([1, 2, 3]);
	});

	it("create appends at tail sortOrder", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Existing",
				userId: USER_A,
				sortOrder: 4,
			}),
		];

		const created = await taskCaller(USER_A).create({ title: "New task" });
		expect(created.sortOrder).toBe(5);
	});
});

describe("task router ownership oracles", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		nextTaskId = 1;
		vi.clearAllMocks();
	});

	it("create scopes nextActiveSortOrder aggregate by userId and active status", async () => {
		await taskCaller(USER_A).create({ title: "New task" });

		expect(db.task.aggregate).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_A, status: "active" },
			}),
		);
	});

	it("update on foreign task scopes findFirst and skips update", async () => {
		allTasks = [makeTask({ id: 9, title: "Victim task", userId: USER_B })];

		await expect(
			taskCaller(USER_A).update({ id: 9, title: "Stolen" }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(db.task.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 9, userId: USER_A },
			}),
		);
		expect(db.task.update).not.toHaveBeenCalled();
	});

	it("delete on foreign task scopes findFirst and skips delete", async () => {
		allTasks = [makeTask({ id: 9, title: "Victim task", userId: USER_B })];

		await expect(taskCaller(USER_A).delete({ id: 9 })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		expect(db.task.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 9, userId: USER_A },
			}),
		);
		expect(db.task.delete).not.toHaveBeenCalled();
	});

	it("list with localDateKey queries completions for caller and date", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Standing",
				userId: USER_A,
				isDailyStanding: true,
			}),
		];
		taskDayCompletions = [
			{ userId: USER_A, taskId: 1, localDateKey: "2026-06-19" },
		];

		const list = await taskCaller(USER_A).list({ localDateKey: "2026-06-19" });

		expect(db.taskDayCompletion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_A, localDateKey: "2026-06-19" },
			}),
		);
		expect(list[0]?.doneForToday).toBe(true);
	});

	it("reorder loads active tasks scoped by caller userId", async () => {
		allTasks = [
			makeTask({ id: 1, title: "One", userId: USER_A, sortOrder: 0 }),
			makeTask({ id: 2, title: "Two", userId: USER_A, sortOrder: 1 }),
		];

		await taskCaller(USER_A).reorder({ orderedIds: [2, 1] });

		expect(db.task.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_A, status: "active" },
			}),
		);
	});
});

describe("Eisenhower task attributes", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		nextTaskId = 1;
		vi.clearAllMocks();
	});

	it("create persists all Eisenhower attributes", async () => {
		const created = await taskCaller(USER_A).create({
			title: "Plan release",
			workType: "DEEP_WORK",
			importance: 3,
			urgency: 2,
			effortMinutes: 45,
			commitmentHorizon: "THIS_WEEK",
		});

		expect(created).toMatchObject({
			title: "Plan release",
			workType: "DEEP_WORK",
			importance: 3,
			urgency: 2,
			weight: 2,
			effortMinutes: 45,
			commitmentHorizon: "THIS_WEEK",
		});
	});

	it("update mirrors urgency into weight column", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Follow up",
				userId: USER_A,
				urgency: 1,
				weight: 1,
			}),
		];

		await taskCaller(USER_A).update({ id: 1, urgency: 3 });

		const row = allTasks.find((t) => t.id === 1);
		expect(row).toMatchObject({ urgency: 3, weight: 3 });
	});

	it("create persists personaPresetId for custom sentinel", async () => {
		const created = await taskCaller(USER_A).create({
			title: "Custom task",
			personaPresetId: "custom",
		});

		expect(created.personaPresetId).toBe("custom");
	});

	it("create persists personaPresetId for known preset id", async () => {
		const created = await taskCaller(USER_A).create({
			title: "Deep work",
			personaPresetId: "focus",
		});

		expect(created.personaPresetId).toBe("focus");
	});

	it("create rejects unknown personaPresetId", async () => {
		await expect(
			taskCaller(USER_A).create({
				title: "Bad preset",
				personaPresetId: "not-a-preset",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("daily standing task flag", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		nextTaskId = 1;
		vi.clearAllMocks();
	});

	it("create persists isDailyStanding", async () => {
		const created = await taskCaller(USER_A).create({
			title: "Morning standup prep",
			isDailyStanding: true,
		});

		expect(created.isDailyStanding).toBe(true);
	});

	it("update toggles isDailyStanding", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Inbox sweep",
				userId: USER_A,
				isDailyStanding: false,
			}),
		];

		await taskCaller(USER_A).update({ id: 1, isDailyStanding: true });

		expect(allTasks.find((t) => t.id === 1)?.isDailyStanding).toBe(true);
	});

	it("markDoneForToday upserts completion for standing task", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "Daily review",
				userId: USER_A,
				isDailyStanding: true,
			}),
		];

		await taskCaller(USER_A).markDoneForToday({
			taskId: 1,
			localDateKey: "2026-06-19",
		});

		expect(taskDayCompletions).toEqual([
			{
				userId: USER_A,
				taskId: 1,
				localDateKey: "2026-06-19",
			},
		]);
	});

	it("markDoneForToday rejects non-standing task", async () => {
		allTasks = [
			makeTask({
				id: 1,
				title: "One-off",
				userId: USER_A,
				isDailyStanding: false,
			}),
		];

		await expect(
			taskCaller(USER_A).markDoneForToday({
				taskId: 1,
				localDateKey: "2026-06-19",
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
