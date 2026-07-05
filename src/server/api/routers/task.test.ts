import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getStaleArchiveCutoff,
	matchesStaleArchivePredicate,
} from "~/lib/task/stale-task-archive";

/**
 * Feature: neon-auth, Property 9: Task creation ownership
 * Validates: Requirements 9.2
 */

// Capture values passed to task.create()
let capturedData: Record<string, unknown> | null = null;

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
	workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight?: number;
	importance?: number;
	urgency?: number;
	effortMinutes?: number | null;
	commitmentHorizon?: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	personaPresetId?: string | null;
	resumeNote?: string | null;
};

let allTasks: TaskRow[] = [];
let taskDayCompletions: Array<{
	userId: string;
	taskId: number;
	localDateKey: string;
}> = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	return {
		db: {
			task: {
				findMany: vi.fn(
					(args?: {
						where?: {
							userId?: string;
							status?: string;
							id?: { in?: number[] };
						};
						orderBy?: Array<{
							sortOrder?: "asc" | "desc";
							createdAt?: "asc" | "desc";
							archivedAt?: "asc" | "desc";
						}>;
						select?: { id?: true; status?: true };
					}) => {
						let rows = [...allTasks];
						if (args?.where?.userId != null) {
							rows = rows.filter((t) => t.userId === args.where?.userId);
						}
						if (args?.where?.status != null) {
							rows = rows.filter((t) => t.status === args.where?.status);
						}
						if (args?.where?.id?.in != null) {
							const allowed = new Set(args.where.id.in);
							rows = rows.filter((t) => allowed.has(t.id));
						}
						if (args?.orderBy) {
							for (const clause of [...args.orderBy].reverse()) {
								if (clause.archivedAt != null) {
									const dir = clause.archivedAt === "asc" ? 1 : -1;
									rows.sort((a, b) => {
										const aTime = a.archivedAt?.getTime() ?? 0;
										const bTime = b.archivedAt?.getTime() ?? 0;
										return (aTime - bTime) * dir;
									});
								}
								if (clause.createdAt != null) {
									const dir = clause.createdAt === "asc" ? 1 : -1;
									rows.sort(
										(a, b) =>
											(a.createdAt.getTime() - b.createdAt.getTime()) * dir,
									);
								}
								if (clause.sortOrder != null) {
									const dir = clause.sortOrder === "asc" ? 1 : -1;
									rows.sort((a, b) => (a.sortOrder - b.sortOrder) * dir);
								}
							}
						}
						if (args?.select?.id) {
							return Promise.resolve(
								rows.map((t) => ({
									id: t.id,
									...(args.select?.status ? { status: t.status } : {}),
								})),
							);
						}
						return Promise.resolve(rows);
					},
				),
				aggregate: vi.fn(
					(args?: { where?: { userId?: string; status?: string } }) => {
						const rows = allTasks.filter(
							(t) =>
								(args?.where?.userId == null ||
									t.userId === args.where.userId) &&
								(args?.where?.status == null || t.status === args.where.status),
						);
						const maxSortOrder =
							rows.length === 0
								? null
								: Math.max(...rows.map((t) => t.sortOrder));
						return Promise.resolve({ _max: { sortOrder: maxSortOrder } });
					},
				),
				create: vi.fn((args: { data: Record<string, unknown> }) => {
					capturedData = args.data;
					// Mirror the schema default so the returned row has a valid status.
					return Promise.resolve({ status: "active", id: 1, ...args.data });
				}),
				findFirst: vi.fn(
					(args?: {
						where?: { id?: number; userId?: string; status?: string };
					}) => {
						return Promise.resolve(
							allTasks.find(
								(t) =>
									(args?.where?.id == null || t.id === args.where.id) &&
									(args?.where?.userId == null ||
										t.userId === args.where.userId) &&
									(args?.where?.status == null ||
										t.status === args.where.status),
							) ?? null,
						);
					},
				),
				update: vi.fn(
					(args: { where: { id: number }; data: Partial<TaskRow> }) => {
						const task = allTasks.find((t) => t.id === args.where.id);
						if (!task) {
							throw new Error("not found");
						}
						Object.assign(task, args.data);
						return Promise.resolve(task);
					},
				),
				updateMany: vi.fn(
					(args: {
						where: {
							userId: string;
							status: string;
							isDailyStanding: boolean;
							OR: Array<{
								updatedAt?: { lte: Date } | null;
								createdAt?: { lte: Date };
							}>;
						};
						data: { status: string; archivedAt: Date };
					}) => {
						const cutoff =
							args.where.OR[0]?.updatedAt &&
							typeof args.where.OR[0].updatedAt === "object"
								? args.where.OR[0].updatedAt.lte
								: args.where.OR[1]?.createdAt?.lte;
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
				),
				deleteMany: vi.fn(
					(args: {
						where: {
							userId: string;
							id: { in: number[] };
							status: string;
						};
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
				),
				delete: vi.fn(() => Promise.resolve({ id: 1 })),
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
const USER_ID = "task-query-user";

function makeTaskRow(
	overrides: Partial<TaskRow> & Pick<TaskRow, "id" | "title" | "status">,
): TaskRow {
	return {
		userId: USER_ID,
		sortOrder: overrides.id,
		createdAt: new Date("2026-06-01T00:00:00.000Z"),
		updatedAt: null,
		archivedAt: null,
		isDailyStanding: false,
		...overrides,
	};
}

function taskCaller(userId: string = USER_ID) {
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
	.string({ minLength: 1, maxLength: 255 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for valid task titles (1-256 chars, non-empty) */
const taskTitleArb = fc
	.string({ minLength: 1, maxLength: 256 })
	.filter((s) => s.trim().length > 0);

/** Arbitrary for email-like strings */
const emailArb = fc
	.tuple(
		fc.stringMatching(/^[a-z]{1,20}$/),
		fc.stringMatching(/^[a-z]{1,10}$/),
		fc.constantFrom("com", "org", "net", "io"),
	)
	.map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

describe("Feature: neon-auth, Property 9: Task creation ownership", () => {
	beforeEach(() => {
		capturedData = null;
		allTasks = [];
		taskDayCompletions = [];
	});

	fcTest.prop([userIdArb, taskTitleArb, emailArb], { numRuns: 100 })(
		"created task always has userId matching the authenticated user's ID",
		async (userId, title, email) => {
			const caller = createCaller({
				db: (await import("~/server/db/index")).db as never,
				session: {
					user: {
						id: userId,
						email,
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			await caller.create({ title });

			expect(capturedData).not.toBeNull();
			expect(capturedData?.userId).toBe(userId);
			expect(capturedData?.title).toBe(title);
		},
	);
});

describe("task query edge branches", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		vi.clearAllMocks();
	});

	it("list with localDateKey marks standing tasks done for that date", async () => {
		allTasks = [
			makeTaskRow({
				id: 1,
				title: "Standing",
				status: "active",
				isDailyStanding: true,
			}),
			makeTaskRow({
				id: 2,
				title: "Regular",
				status: "active",
			}),
		];
		taskDayCompletions = [
			{ userId: USER_ID, taskId: 1, localDateKey: "2026-06-19" },
		];

		const list = await taskCaller().list({ localDateKey: "2026-06-19" });

		expect(db.taskDayCompletion.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_ID, localDateKey: "2026-06-19" },
			}),
		);
		expect(list.find((t) => t.id === 1)?.doneForToday).toBe(true);
		expect(list.find((t) => t.id === 2)?.doneForToday).toBe(false);
	});

	it("reorder rejects when orderedIds do not match active owned set size", async () => {
		allTasks = [
			makeTaskRow({ id: 1, title: "One", status: "active" }),
			makeTaskRow({ id: 2, title: "Two", status: "active" }),
		];

		await expect(
			taskCaller().reorder({ orderedIds: [1] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(db.task.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: USER_ID, status: "active" },
			}),
		);
	});
});

describe("default-status fork", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		vi.clearAllMocks();
	});

	it("creates a normal task as planned", async () => {
		await taskCaller().create({ title: "Backlog item" });
		expect(capturedData?.status).toBe("planned");
	});

	it("creates a daily-standing task as active", async () => {
		await taskCaller().create({
			title: "Daily standing item",
			isDailyStanding: true,
		});
		expect(capturedData?.status).toBe("active");
	});
});

describe("planned -> active promotion", () => {
	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		vi.clearAllMocks();
	});

	it("assigns a fresh active sortOrder when promoting a planned task", async () => {
		allTasks = [
			makeTaskRow({ id: 1, title: "Active", status: "active", sortOrder: 0 }),
			makeTaskRow({ id: 2, title: "Planned", status: "planned", sortOrder: 0 }),
		];

		await taskCaller().update({ id: 2, status: "active" });

		expect(allTasks.find((t) => t.id === 2)?.status).toBe("active");
		expect(allTasks.find((t) => t.id === 2)?.sortOrder).toBe(1);
	});
});

describe("stale task archive sweep", () => {
	const now = new Date();
	const cutoff = getStaleArchiveCutoff(now);

	beforeEach(() => {
		allTasks = [];
		taskDayCompletions = [];
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it("archives stale active non-standing tasks on list using updatedAt ?? createdAt", async () => {
		// Freeze the clock so the cutoff recomputed inside list() matches the
		// captured `cutoff`; otherwise a slow CI run can reclassify the "Fresh"
		// task as stale. Only fake Date so the immediate-setTimeout shim still runs.
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(now);

		allTasks = [
			makeTaskRow({
				id: 1,
				title: "Stale",
				status: "active",
				updatedAt: new Date(cutoff),
			}),
			makeTaskRow({
				id: 2,
				title: "Fresh",
				status: "active",
				updatedAt: new Date(cutoff.getTime() + 60_000),
			}),
			makeTaskRow({
				id: 3,
				title: "Standing stale",
				status: "active",
				isDailyStanding: true,
				updatedAt: new Date("2020-01-01"),
			}),
			makeTaskRow({
				id: 4,
				title: "Completed stale",
				status: "completed",
				updatedAt: new Date("2020-01-01"),
			}),
			makeTaskRow({
				id: 5,
				title: "Already archived",
				status: "archived",
				archivedAt: new Date("2026-06-20"),
				updatedAt: new Date("2020-01-01"),
			}),
		];

		await taskCaller().list();

		expect(allTasks.find((t) => t.id === 1)?.status).toBe("archived");
		expect(allTasks.find((t) => t.id === 1)?.archivedAt).toBeInstanceOf(Date);
		expect(allTasks.find((t) => t.id === 2)?.status).toBe("active");
		expect(allTasks.find((t) => t.id === 3)?.status).toBe("active");
		expect(allTasks.find((t) => t.id === 4)?.status).toBe("completed");
		expect(allTasks.find((t) => t.id === 5)?.archivedAt).toEqual(
			new Date("2026-06-20"),
		);

		vi.useRealTimers();
	});

	it("archiveList returns archived tasks sorted by archivedAt desc then createdAt desc", async () => {
		allTasks = [
			makeTaskRow({
				id: 1,
				title: "Older archive",
				status: "archived",
				archivedAt: new Date("2026-06-10T12:00:00.000Z"),
				createdAt: new Date("2026-01-01"),
			}),
			makeTaskRow({
				id: 2,
				title: "Newer archive",
				status: "archived",
				archivedAt: new Date("2026-06-20T12:00:00.000Z"),
				createdAt: new Date("2026-01-02"),
			}),
		];

		const archived = await taskCaller().archiveList();

		expect(archived.map((task) => task.id)).toEqual([2, 1]);
	});

	it("restore moves archived task to active tail and clears archivedAt", async () => {
		allTasks = [
			makeTaskRow({ id: 1, title: "Active", status: "active", sortOrder: 0 }),
			makeTaskRow({
				id: 2,
				title: "Archived",
				status: "archived",
				sortOrder: 4,
				archivedAt: new Date("2026-06-20"),
			}),
		];

		const restored = await taskCaller().restore({ id: 2 });

		expect(restored).toMatchObject({
			id: 2,
			status: "active",
			archivedAt: null,
			sortOrder: 1,
		});
	});

	it("deleteArchived removes only archived owned ids and rejects mixed sets", async () => {
		allTasks = [
			makeTaskRow({ id: 1, title: "Archived A", status: "archived" }),
			makeTaskRow({ id: 2, title: "Archived B", status: "archived" }),
			makeTaskRow({ id: 3, title: "Active", status: "active" }),
		];

		const result = await taskCaller().deleteArchived({ ids: [1, 2] });

		expect(result).toEqual({ deletedCount: 2 });
		expect(allTasks.map((task) => task.id)).toEqual([3]);

		await expect(
			taskCaller().deleteArchived({ ids: [3] }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
