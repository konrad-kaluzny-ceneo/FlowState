import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchesStaleArchivePredicate } from "~/lib/task/stale-task-archive";

/**
 * Feature: neon-auth, Property 10: Task query isolation
 * Validates: Requirements 9.3
 */

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date | null;
	archivedAt: Date | null;
	isDailyStanding: boolean;
};

// Store all tasks in an in-memory array; the mock db will filter them
let allTasks: TaskRow[] = [];

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
		id?: number | { in?: number[] };
	};
	select?: { id?: true; status?: true };
	orderBy?: Array<{
		sortOrder?: "asc" | "desc";
		createdAt?: "asc" | "desc";
		archivedAt?: "asc" | "desc";
	}>;
}): TaskRow[] | Array<{ id: number; status?: string }> {
	let rows = [...allTasks];

	if (args.where?.userId != null) {
		rows = rows.filter((t) => t.userId === args.where?.userId);
	}
	if (args.where?.status != null) {
		rows = rows.filter((t) => t.status === args.where?.status);
	}
	if (args.where?.id != null) {
		if (typeof args.where.id === "number") {
			rows = rows.filter((t) => t.id === args.where?.id);
		} else if (args.where.id.in != null) {
			const allowed = new Set(args.where.id.in);
			rows = rows.filter((t) => allowed.has(t.id));
		}
	}

	if (args.orderBy) {
		for (const clause of [...args.orderBy].reverse()) {
			if (clause.archivedAt != null) {
				const dir = clause.archivedAt === "asc" ? 1 : -1;
				rows.sort((a, b) => {
					const aTime = a.archivedAt?.getTime() ?? 0;
					const bTime = b.archivedAt?.getTime() ?? 0;
					return (aTime - bTime) * dir;
				});
			}
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
		return rows.map((t) => ({
			id: t.id,
			...(args.select?.status ? { status: t.status } : {}),
		}));
	}

	return rows;
}

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn((args: Parameters<typeof filterTasks>[0]) =>
		Promise.resolve(filterTasks(args)),
	);

	const mockCreate = vi.fn(() => Promise.resolve({ id: 1 }));
	const mockFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string; status?: string } }) => {
			return Promise.resolve(
				allTasks.find(
					(t) =>
						(args?.where?.id == null || t.id === args.where.id) &&
						(args?.where?.userId == null || t.userId === args.where.userId) &&
						(args?.where?.status == null || t.status === args.where.status),
				) ?? null,
			);
		},
	);
	const mockUpdate = vi.fn(
		(args: {
			where: { id: number };
			data: Partial<Pick<TaskRow, "sortOrder" | "status" | "archivedAt">>;
		}) => {
			const task = allTasks.find((t) => t.id === args.where.id);
			if (!task) {
				throw new Error("not found");
			}
			Object.assign(task, args.data);
			return Promise.resolve(task);
		},
	);
	const mockDelete = vi.fn(() => Promise.resolve({ id: 1 }));
	const mockUpdateMany = vi.fn(
		(args: {
			where: {
				userId: string;
				OR: Array<{
					updatedAt?: { lte: Date };
					createdAt?: { lte: Date };
				}>;
			};
			data: { status: string; archivedAt: Date };
		}) => {
			const cutoff =
				args.where.OR[0]?.updatedAt?.lte ?? args.where.OR[1]?.createdAt?.lte;
			if (cutoff == null) {
				return Promise.resolve({ count: 0 });
			}
			let count = 0;
			for (const task of allTasks) {
				if (
					task.userId === args.where.userId &&
					matchesStaleArchivePredicate(task, cutoff)
				) {
					task.status = args.data.status;
					task.archivedAt = args.data.archivedAt;
					count += 1;
				}
			}
			return Promise.resolve({ count });
		},
	);
	const mockDeleteMany = vi.fn(
		(args: {
			where: { userId: string; id: { in: number[] }; status: string };
		}) => {
			const ids = new Set(args.where.id.in);
			const before = allTasks.length;
			allTasks = allTasks.filter(
				(task) =>
					!(
						task.userId === args.where.userId &&
						ids.has(task.id) &&
						task.status === args.where.status
					),
			);
			return Promise.resolve({ count: before - allTasks.length });
		},
	);
	const mockAggregate = vi.fn(
		(args: {
			where?: { userId?: string; status?: string };
			_max?: { sortOrder?: true };
		}) => {
			const rows = filterTasks({ where: args.where }) as TaskRow[];
			const maxSortOrder =
				rows.length === 0 ? null : Math.max(...rows.map((t) => t.sortOrder));
			return Promise.resolve({ _max: { sortOrder: maxSortOrder } });
		},
	);

	return {
		db: {
			task: {
				findMany: mockFindMany,
				create: mockCreate,
				findFirst: mockFindFirst,
				update: mockUpdate,
				delete: mockDelete,
				updateMany: mockUpdateMany,
				deleteMany: mockDeleteMany,
				aggregate: mockAggregate,
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

import { atModOrThrow, atOrThrow } from "~/test-utils/array-access";
import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(taskRouter);

const USER_A = "user-a";
const USER_B = "user-b";

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

/** Arbitrary for non-empty user IDs (alphanumeric to avoid edge cases with special chars) */
const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: neon-auth, Property 10: Task query isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	fcTest.prop(
		[
			// Generate 2-5 distinct user IDs
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			// A seed to pick which user is the "querying" user
			fc.nat(),
		],
		{ numRuns: 100 },
	)(
		"each user only sees their own tasks when querying",
		async (userIds, querierSeed) => {
			// Pick the querying user
			const querierIdx = querierSeed % userIds.length;
			const querierId = atOrThrow(userIds, querierIdx);

			// Generate between 5 and 20 tasks distributed across all users
			const taskCount = 5 + (querierSeed % 16);
			const generatedTasks = [];
			for (let i = 0; i < taskCount; i++) {
				const userId = atModOrThrow(userIds, i);
				generatedTasks.push({
					id: i + 1,
					title: `Task ${i}`,
					status: i % 3 === 0 ? "completed" : "active",
					userId,
					sortOrder: i,
					createdAt: new Date(2024, 0, i + 1),
					updatedAt: null,
					archivedAt: null,
					isDailyStanding: false,
				});
			}

			allTasks = generatedTasks;

			// Expected: only tasks belonging to the querying user
			const expectedTasks = allTasks.filter((t) => t.userId === querierId);

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: querierId,
						email: "test@example.com",
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			const result = await caller.list();

			// Property: result contains ONLY tasks belonging to the querying user
			for (const task of result) {
				expect(task.userId).toBe(querierId);
			}

			// Property: result contains ALL tasks belonging to the querying user
			expect(result).toHaveLength(expectedTasks.length);
		},
	);

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 100 },
	)("a user with no tasks gets an empty result", async (userIds, seed) => {
		// Assign all tasks to users OTHER than the querying user
		const querierId = atOrThrow(userIds, 0);
		const otherUserIds = userIds.slice(1);

		const taskCount = 3 + (seed % 10);
		allTasks = [];
		for (let i = 0; i < taskCount; i++) {
			const ownerId = atModOrThrow(otherUserIds, i);
			allTasks.push({
				id: i + 1,
				title: `Task ${i}`,
				status: "active",
				userId: ownerId,
				sortOrder: i,
				createdAt: new Date(2024, 0, i + 1),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			});
		}

		const caller = createCaller({
			db: db as never,
			session: {
				user: {
					id: querierId,
					email: "test@example.com",
					name: "Test User",
				},
			},
			headers: new Headers(),
		});

		const result = await caller.list();

		// Property: empty array when user owns no tasks
		expect(result).toHaveLength(0);
	});
});

describe("task reorder isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	it("user B sortOrder values unchanged after user A reorders", async () => {
		allTasks = [
			{
				id: 1,
				title: "A1",
				status: "active",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "A2",
				status: "active",
				userId: USER_A,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 2),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
			{
				id: 10,
				title: "B1",
				status: "active",
				userId: USER_B,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 10),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
			{
				id: 11,
				title: "B2",
				status: "active",
				userId: USER_B,
				sortOrder: 1,
				createdAt: new Date(2024, 0, 11),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
		];

		const bBefore = allTasks
			.filter((t) => t.userId === USER_B)
			.map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

		await taskCaller(USER_A).reorder({ orderedIds: [2, 1] });

		const bAfter = allTasks
			.filter((t) => t.userId === USER_B)
			.map((t) => ({ id: t.id, sortOrder: t.sortOrder }));

		expect(bAfter).toEqual(bBefore);

		const aList = await taskCaller(USER_A).list();
		expect(aList.map((t) => t.id)).toEqual([2, 1]);
	});
});

describe("blocked status isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	it("user can set a task to blocked and read it back", async () => {
		allTasks = [
			{
				id: 1,
				title: "Block me",
				status: "active",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
		];

		await taskCaller(USER_A).update({ id: 1, status: "blocked" });

		const list = await taskCaller(USER_A).list();
		expect(list.find((t) => t.id === 1)?.status).toBe("blocked");
	});

	it("blocked task of user A is not visible to user B", async () => {
		allTasks = [
			{
				id: 1,
				title: "A blocked",
				status: "blocked",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
		];

		const list = await taskCaller(USER_B).list();
		expect(list).toHaveLength(0);
	});

	it("unblocking (blocked→active) assigns a sortOrder past existing actives", async () => {
		allTasks = [
			{
				id: 1,
				title: "Existing active",
				status: "active",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date(2024, 0, 1),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "Blocked task",
				status: "blocked",
				userId: USER_A,
				sortOrder: 5,
				createdAt: new Date(2024, 0, 2),
				updatedAt: null,
				archivedAt: null,
				isDailyStanding: false,
			},
		];

		await taskCaller(USER_A).update({ id: 2, status: "active" });

		const unblocked = allTasks.find((t) => t.id === 2);
		expect(unblocked?.status).toBe("active");
		expect(unblocked?.sortOrder).toBe(1);
	});
});

describe("archive isolation", () => {
	beforeEach(() => {
		allTasks = [];
		vi.clearAllMocks();
	});

	it("archiveList returns only the caller's archived tasks", async () => {
		allTasks = [
			{
				id: 1,
				title: "A archived",
				status: "archived",
				userId: USER_A,
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				updatedAt: null,
				archivedAt: new Date("2026-06-20"),
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "B archived",
				status: "archived",
				userId: USER_B,
				sortOrder: 0,
				createdAt: new Date("2026-01-02"),
				updatedAt: null,
				archivedAt: new Date("2026-06-21"),
				isDailyStanding: false,
			},
		];

		const list = await taskCaller(USER_A).archiveList();

		expect(list).toHaveLength(1);
		expect(list[0]?.id).toBe(1);
	});

	it("restore and deleteArchived deny cross-user archived tasks without writes", async () => {
		allTasks = [
			{
				id: 1,
				title: "B archived",
				status: "archived",
				userId: USER_B,
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				updatedAt: null,
				archivedAt: new Date("2026-06-20"),
				isDailyStanding: false,
			},
		];

		await expect(taskCaller(USER_A).restore({ id: 1 })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(
			taskCaller(USER_A).deleteArchived({ ids: [1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(allTasks).toHaveLength(1);
		expect(allTasks[0]?.status).toBe("archived");
		expect(db.task.update).not.toHaveBeenCalled();
		expect(db.task.deleteMany).not.toHaveBeenCalled();
	});
});
