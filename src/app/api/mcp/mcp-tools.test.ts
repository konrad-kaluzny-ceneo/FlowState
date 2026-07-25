import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: MCP server (S-46), Property: curated tool delegation + scope gating.
 * Validates (per lessons L-06, at the createCaller layer — no HTTP/browser):
 *  - a READ scope is denied write tools;
 *  - a READ_WRITE scope creates a task visible via list_tasks;
 *  - tools are user-scoped (user A never sees user B's tasks);
 *  - tRPC errors map to safe `isError` tool responses.
 */

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date | null;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance: number;
	urgency: number;
	effortMinutes: number | null;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	resumeNote: string | null;
	project: string | null;
	personaPresetId: string | null;
	isDailyStanding: boolean;
	archivedAt: Date | null;
};

let allTasks: TaskRow[] = [];
let nextId = 1;

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

function filterTasks(where?: {
	userId?: string;
	status?: string | { in?: string[]; notIn?: string[] };
}): TaskRow[] {
	let rows = [...allTasks];
	if (where?.userId != null)
		rows = rows.filter((t) => t.userId === where.userId);
	if (typeof where?.status === "string") {
		rows = rows.filter((t) => t.status === where.status);
	} else if (where?.status?.in != null) {
		const allowed = new Set(where.status.in);
		rows = rows.filter((t) => allowed.has(t.status));
	} else if (where?.status?.notIn != null) {
		const blocked = new Set(where.status.notIn);
		rows = rows.filter((t) => !blocked.has(t.status));
	}
	return rows;
}

vi.mock("~/server/db/index", () => {
	const task = {
		findMany: vi.fn((args: { where?: { userId?: string; status?: string } }) =>
			Promise.resolve(filterTasks(args.where)),
		),
		updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
		aggregate: vi.fn(
			(args: { where?: { userId?: string; status?: string } }) => {
				const rows = filterTasks(args.where);
				const max =
					rows.length === 0 ? null : Math.max(...rows.map((t) => t.sortOrder));
				return Promise.resolve({ _max: { sortOrder: max } });
			},
		),
		create: vi.fn(
			(args: {
				data: {
					title: string;
					userId: string;
					sortOrder: number;
					importance: number;
					urgency: number;
					weight: number;
					status: string;
					effortMinutes: number | null;
					commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
					workType?: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
					resumeNote?: string | null;
					project?: string | null;
					personaPresetId?: string | null;
					isDailyStanding?: boolean;
				};
			}) => {
				const row: TaskRow = {
					id: nextId++,
					title: args.data.title,
					status: args.data.status,
					userId: args.data.userId,
					createdAt: new Date(),
					updatedAt: null,
					workType: args.data.workType ?? "OPERATIONAL",
					weight: args.data.weight,
					importance: args.data.importance,
					urgency: args.data.urgency,
					effortMinutes: args.data.effortMinutes ?? null,
					commitmentHorizon: args.data.commitmentHorizon,
					sortOrder: args.data.sortOrder,
					resumeNote: args.data.resumeNote ?? null,
					project: args.data.project ?? null,
					personaPresetId: args.data.personaPresetId ?? null,
					isDailyStanding: args.data.isDailyStanding ?? false,
					archivedAt: null,
				};
				allTasks.push(row);
				return Promise.resolve(row);
			},
		),
		findFirst: vi.fn(
			(args: { where?: { id?: number; userId?: string; status?: string } }) =>
				Promise.resolve(
					allTasks.find(
						(t) =>
							(args?.where?.id == null || t.id === args.where.id) &&
							(args?.where?.userId == null || t.userId === args.where.userId) &&
							(args?.where?.status == null || t.status === args.where.status),
					) ?? null,
				),
		),
		update: vi.fn((args: { where: { id: number }; data: Partial<TaskRow> }) => {
			const row = allTasks.find((t) => t.id === args.where.id);
			if (!row) throw new Error("not found");
			Object.assign(row, args.data);
			return Promise.resolve(row);
		}),
	};

	const taskDayCompletion = {
		findMany: vi.fn(() => Promise.resolve([])),
		deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
	};

	const dbMock = {
		task,
		taskDayCompletion,
		$transaction: vi.fn(
			async (ops: Array<Promise<unknown>> | ((tx: unknown) => unknown)) => {
				if (typeof ops === "function") {
					return ops((await import("~/server/db/index")).db);
				}
				return Promise.all(ops);
			},
		),
	};

	return { db: dbMock };
});

const { createCaller } = await import("~/server/api/root");
const { db } = await import("~/server/db/index");
const tools = await import("~/app/api/mcp/mcp-tools");

function callerFor(userId: string): ReturnType<typeof createCaller> {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: `${userId}@example.com`,
				name: `User ${userId}`,
			},
		},
		headers: new Headers(),
	});
}

function textOf(result: { content: Array<{ type: string; text?: string }> }) {
	return result.content
		.map((c) => {
			// A valid MCP text content block must carry a string `text`. Asserting
			// here means a void-returning tool that serializes to `text: undefined`
			// fails loudly instead of being silently coerced to "" (regression guard
			// for update_task/complete_task returning an invalid CallToolResult).
			expect(typeof c.text).toBe("string");
			return c.text ?? "";
		})
		.join("");
}

const USER_A = "user-a";
const USER_B = "user-b";

describe("Feature: MCP server (S-46), curated tool delegation + scope gating", () => {
	beforeEach(() => {
		allTasks = [];
		nextId = 1;
		vi.clearAllMocks();
	});

	it("create_task is denied for a READ scope and writes nothing", async () => {
		const result = await tools.createTask(
			callerFor(USER_A),
			{ title: "Should not exist" },
			"READ",
		);

		expect(result.isError).toBe(true);
		expect(textOf(result)).toContain("read-write");
		expect(db.task.create).not.toHaveBeenCalled();
		expect(allTasks).toHaveLength(0);
	});

	it("create_task with READ_WRITE creates a task visible via list_tasks", async () => {
		const created = await tools.createTask(
			callerFor(USER_A),
			{ title: "Write the report", workType: "DEEP_WORK" },
			"READ_WRITE",
		);
		expect(created.isError).toBeUndefined();

		const listed = await tools.listTasks(callerFor(USER_A), {}, "READ_WRITE");
		expect(listed.isError).toBeUndefined();
		const payload = JSON.parse(textOf(listed)) as Array<{ title: string }>;
		expect(payload).toHaveLength(1);
		expect(payload[0]?.title).toBe("Write the report");
	});

	it("list_tasks is user-scoped: user A never sees user B's tasks", async () => {
		await tools.createTask(
			callerFor(USER_B),
			{ title: "B private task" },
			"READ_WRITE",
		);

		const aList = await tools.listTasks(callerFor(USER_A), {}, "READ");
		const aPayload = JSON.parse(textOf(aList)) as unknown[];
		expect(aPayload).toHaveLength(0);

		const bList = await tools.listTasks(callerFor(USER_B), {}, "READ");
		const bPayload = JSON.parse(textOf(bList)) as Array<{ title: string }>;
		expect(bPayload).toHaveLength(1);
		expect(bPayload[0]?.title).toBe("B private task");
	});

	it("complete_task with READ_WRITE marks the task completed", async () => {
		await tools.createTask(
			callerFor(USER_A),
			{ title: "Finish me" },
			"READ_WRITE",
		);
		const taskId = allTasks[0]?.id as number;

		const result = await tools.completeTask(
			callerFor(USER_A),
			{ id: taskId },
			"READ_WRITE",
		);
		expect(result.isError).toBeUndefined();
		expect(allTasks[0]?.status).toBe("completed");
		// The tool must return the updated task as a valid JSON content block, not
		// a void result that serializes to `text: undefined` (invalid MCP result).
		const payload = JSON.parse(textOf(result)) as {
			id: number;
			status: string;
		};
		expect(payload.id).toBe(taskId);
		expect(payload.status).toBe("completed");
	});

	it("update_task with READ_WRITE returns the updated task", async () => {
		await tools.createTask(
			callerFor(USER_A),
			{ title: "Before" },
			"READ_WRITE",
		);
		const taskId = allTasks[0]?.id as number;

		const result = await tools.updateTask(
			callerFor(USER_A),
			{ id: taskId, title: "After", urgency: 3 },
			"READ_WRITE",
		);
		expect(result.isError).toBeUndefined();
		const payload = JSON.parse(textOf(result)) as {
			id: number;
			title: string;
			urgency: number;
		};
		expect(payload.id).toBe(taskId);
		expect(payload.title).toBe("After");
		expect(payload.urgency).toBe(3);
	});

	it("maps a NOT_FOUND tRPC error to a safe tool error (no stack trace)", async () => {
		const result = await tools.updateTask(
			callerFor(USER_A),
			{ id: 9999, title: "ghost" },
			"READ_WRITE",
		);

		expect(result.isError).toBe(true);
		expect(textOf(result)).toBe("The requested item was not found.");
		expect(textOf(result)).not.toMatch(/at .*\(/); // no stack frames
	});

	it("update_task is denied for a READ scope and writes nothing", async () => {
		await tools.createTask(
			callerFor(USER_A),
			{ title: "Original" },
			"READ_WRITE",
		);
		const taskId = allTasks[0]?.id as number;
		vi.clearAllMocks();

		const result = await tools.updateTask(
			callerFor(USER_A),
			{ id: taskId, title: "Hijacked" },
			"READ",
		);

		expect(result.isError).toBe(true);
		expect(db.task.update).not.toHaveBeenCalled();
		expect(allTasks[0]?.title).toBe("Original");
	});
});
