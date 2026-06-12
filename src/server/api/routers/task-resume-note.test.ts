import { beforeEach, describe, expect, it, vi } from "vitest";

let capturedUpdate: Record<string, unknown> | null = null;
let existingTask: Record<string, unknown> | null = null;

vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

vi.mock("~/server/db/index", () => ({
	db: {
		task: {
			findMany: vi.fn(() => Promise.resolve([])),
			aggregate: vi.fn(() =>
				Promise.resolve({ _max: { sortOrder: null as number | null } }),
			),
			create: vi.fn((args: { data: Record<string, unknown> }) =>
				Promise.resolve({ id: 1, ...args.data }),
			),
			findFirst: vi.fn(() => Promise.resolve(existingTask)),
			update: vi.fn((args: { data: Record<string, unknown> }) => {
				capturedUpdate = args.data;
				return Promise.resolve({ id: 1, ...args.data });
			}),
			delete: vi.fn(() => Promise.resolve({ id: 1 })),
		},
	},
}));

import { taskRouter } from "~/server/api/routers/task";
import { createCallerFactory } from "~/server/api/trpc";

const createCaller = createCallerFactory(taskRouter);

describe("task resumeNote", () => {
	beforeEach(() => {
		capturedUpdate = null;
		existingTask = {
			id: 5,
			userId: "user-1",
			title: "Task",
			status: "active",
			sortOrder: 0,
			resumeNote: "old note",
		};
	});

	it("persists resumeNote on update", async () => {
		const caller = createCaller({
			db: (await import("~/server/db/index")).db as never,
			session: { user: { id: "user-1", email: "a@b.com", name: "Test" } },
			headers: new Headers(),
		});

		await caller.update({ id: 5, resumeNote: "left off at line 42" });

		expect(capturedUpdate?.resumeNote).toBe("left off at line 42");
	});

	it("clears resumeNote when task is completed", async () => {
		const caller = createCaller({
			db: (await import("~/server/db/index")).db as never,
			session: { user: { id: "user-1", email: "a@b.com", name: "Test" } },
			headers: new Headers(),
		});

		await caller.update({ id: 5, status: "completed" });

		expect(capturedUpdate?.status).toBe("completed");
		expect(capturedUpdate?.resumeNote).toBeNull();
	});
});
