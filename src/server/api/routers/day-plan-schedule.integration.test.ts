import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

vi.mock("~/server/db/index", async () => {
	const { scheduleTestDb } = await import("./day-plan-schedule.test-db");
	return { db: scheduleTestDb };
});

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { dayPlanRouter } = await import("~/server/api/routers/day-plan");
const { db } = await import("~/server/db/index");
const {
	MAX_CONTEXT_TAGS_PER_USER,
	SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
	SCHEDULE_AXIS_MESSAGE,
	SCHEDULE_CONTEXT_XOR_MESSAGE,
	SCHEDULE_OVERLAP_MESSAGE,
	SCHEDULE_TAG_CAP_MESSAGE,
	SCHEDULE_TAG_IN_USE_MESSAGE,
	SCHEDULE_TASK_ATTACH_MESSAGE,
} = await import("~/server/api/lib/schedule-blocks");
const { resetScheduleTestDb, seedContextTag, seedScheduleTask } = await import(
	"./day-plan-schedule.test-db"
);

const createCaller = createCallerFactory(dayPlanRouter);

const USER_A = "schedule-user-a";
const USER_B = "schedule-user-b";
const DATE_KEY = "2026-08-17";

function caller(userId: string) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: `${userId}@example.com`,
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

describe("dayPlan schedule integration", () => {
	beforeEach(() => {
		resetScheduleTestDb();
	});

	it("creates adjacent blocks and lists them by startMinute", async () => {
		const api = caller(USER_A);

		const morning = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		const later = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "BREAK",
			startMinute: 570,
			durationMinutes: 15,
		});

		const listed = await api.listBlocks({ localDateKey: DATE_KEY });
		expect(listed.map((block) => block.id)).toEqual([morning.id, later.id]);
		expect(listed.map((block) => block.startMinute)).toEqual([540, 570]);
	});

	it("updates and deletes a block", async () => {
		const api = caller(USER_A);
		const created = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "MEETING",
			startMinute: 600,
			durationMinutes: 30,
		});

		const updated = await api.updateBlock({
			blockId: created.id,
			startMinute: 630,
			durationMinutes: 45,
		});
		expect(updated.startMinute).toBe(630);
		expect(updated.durationMinutes).toBe(45);

		await api.deleteBlock({ blockId: created.id });
		expect(await api.listBlocks({ localDateKey: DATE_KEY })).toEqual([]);
	});

	it("rejects overlapping create with CONFLICT (manual 2.4 oracle)", async () => {
		const api = caller(USER_A);
		await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});

		await expect(
			api.createBlock({
				localDateKey: DATE_KEY,
				blockType: "MEETING",
				startMinute: 555,
				durationMinutes: 30,
			}),
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: SCHEDULE_OVERLAP_MESSAGE,
		});
	});

	it("rejects overlapping update with CONFLICT", async () => {
		const api = caller(USER_A);
		await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		const moving = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "BREAK",
			startMinute: 600,
			durationMinutes: 30,
		});

		await expect(
			api.updateBlock({
				blockId: moving.id,
				startMinute: 555,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });
	});

	it("persists a custom context tag on a block (manual 2.4 oracle)", async () => {
		const api = caller(USER_A);
		const tag = await api.createContextTag({ label: "  Dom\u0007 " });
		expect(tag.label).toBe("Dom");

		const block = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "PERSONAL",
			startMinute: 720,
			durationMinutes: 30,
			customContextTagId: tag.id,
		});

		expect(block.customContextTagId).toBe(tag.id);
		expect(block.contextLabel).toBe("Dom");
		expect(block.fixedContext).toBeNull();

		const listed = await api.listBlocks({ localDateKey: DATE_KEY });
		expect(listed[0]?.contextLabel).toBe("Dom");
		expect(listed[0]?.customContextTagId).toBe(tag.id);
	});

	it("rejects deleting a context tag that is still assigned", async () => {
		const api = caller(USER_A);
		const tag = await api.createContextTag({ label: "Office desk" });
		await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
			customContextTagId: tag.id,
		});

		await expect(api.deleteContextTag({ tagId: tag.id })).rejects.toMatchObject(
			{
				code: "CONFLICT",
				message: SCHEDULE_TAG_IN_USE_MESSAGE,
			},
		);
	});

	it("deletes an unused context tag", async () => {
		const api = caller(USER_A);
		const tag = await api.createContextTag({ label: "Spare" });
		await api.deleteContextTag({ tagId: tag.id });
		expect(await api.listContextTags()).toEqual([]);
	});

	it("clears focusTaskId when changing FOCUS to another type", async () => {
		const api = caller(USER_A);
		seedScheduleTask({
			id: 11,
			userId: USER_A,
			title: "Deep work",
			status: "active",
		});
		const block = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		await api.setBlockFocusTask({ blockId: block.id, taskId: 11 });

		const updated = await api.updateBlock({
			blockId: block.id,
			blockType: "MEETING",
		});
		expect(updated.blockType).toBe("MEETING");
		expect(updated.focusTaskId).toBeNull();
		expect(updated.focusTask).toBeNull();
	});

	it("clears batch tasks and metaLabel when changing BATCH to another type", async () => {
		const api = caller(USER_A);
		seedScheduleTask({
			id: 21,
			userId: USER_A,
			title: "Call one",
			status: "planned",
		});
		seedScheduleTask({
			id: 22,
			userId: USER_A,
			title: "Call two",
			status: "active",
		});
		const block = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "BATCH",
			startMinute: 600,
			durationMinutes: 30,
			metaLabel: "Telefony",
		});
		await api.setBlockBatchTasks({ blockId: block.id, taskIds: [21, 22] });

		const updated = await api.updateBlock({
			blockId: block.id,
			blockType: "BREAK",
		});
		expect(updated.blockType).toBe("BREAK");
		expect(updated.metaLabel).toBeNull();
		expect(updated.batchTaskIds).toEqual([]);
	});

	it("rejects context XOR when both fixed and custom are set", async () => {
		const api = caller(USER_A);
		const tag = await api.createContextTag({ label: "Home" });

		await expect(
			api.createBlock({
				localDateKey: DATE_KEY,
				blockType: "FOCUS",
				startMinute: 540,
				durationMinutes: 30,
				fixedContext: "PHONE",
				customContextTagId: tag.id,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_CONTEXT_XOR_MESSAGE,
		});
	});

	it("rejects axis overflow past 22:00", async () => {
		const api = caller(USER_A);
		await expect(
			api.createBlock({
				localDateKey: DATE_KEY,
				blockType: "FOCUS",
				startMinute: 1305,
				durationMinutes: 30,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_AXIS_MESSAGE,
		});
	});

	it("rejects a block that starts before 06:00", async () => {
		const api = caller(USER_A);
		await expect(
			api.createBlock({
				localDateKey: DATE_KEY,
				blockType: "FOCUS",
				startMinute: 345,
				durationMinutes: 15,
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_AXIS_MESSAGE,
		});
	});

	it("allows a block that ends exactly at 22:00", async () => {
		const api = caller(USER_A);
		const block = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "PLANNING",
			startMinute: 1305,
			durationMinutes: 15,
		});
		expect(block.startMinute + block.durationMinutes).toBe(1320);
	});

	it("rejects attaching completed, archived, blocked, or delegated tasks", async () => {
		const api = caller(USER_A);
		seedScheduleTask({
			id: 1,
			userId: USER_A,
			title: "Done",
			status: "completed",
		});
		seedScheduleTask({
			id: 2,
			userId: USER_A,
			title: "Old",
			status: "archived",
		});
		seedScheduleTask({
			id: 3,
			userId: USER_A,
			title: "Waiting",
			status: "blocked",
		});
		seedScheduleTask({
			id: 4,
			userId: USER_A,
			title: "Handed off",
			status: "delegated",
		});
		const focus = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		const batch = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "BATCH",
			startMinute: 600,
			durationMinutes: 30,
		});

		for (const taskId of [1, 2, 3, 4]) {
			await expect(
				api.setBlockFocusTask({ blockId: focus.id, taskId }),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: SCHEDULE_TASK_ATTACH_MESSAGE,
			});
			await expect(
				api.setBlockBatchTasks({ blockId: batch.id, taskIds: [taskId] }),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: SCHEDULE_TASK_ATTACH_MESSAGE,
			});
		}
	});

	it("allows attaching active and planned tasks owned by the user", async () => {
		const api = caller(USER_A);
		seedScheduleTask({
			id: 5,
			userId: USER_A,
			title: "Active task",
			status: "active",
		});
		seedScheduleTask({
			id: 6,
			userId: USER_A,
			title: "Planned task",
			status: "planned",
		});
		const focus = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		const batch = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "BATCH",
			startMinute: 600,
			durationMinutes: 30,
		});

		const focused = await api.setBlockFocusTask({
			blockId: focus.id,
			taskId: 5,
		});
		expect(focused.focusTask).toEqual({ id: 5, title: "Active task" });

		const batched = await api.setBlockBatchTasks({
			blockId: batch.id,
			taskIds: [6, 5],
		});
		expect(batched.batchTaskIds).toEqual([6, 5]);
	});

	it("rejects attaching another user's task", async () => {
		const api = caller(USER_A);
		seedScheduleTask({
			id: 7,
			userId: USER_B,
			title: "Not yours",
			status: "active",
		});
		const focus = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});

		await expect(
			api.setBlockFocusTask({ blockId: focus.id, taskId: 7 }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("rejects leftover attachments on an incompatible type", async () => {
		const api = caller(USER_A);
		const meeting = await api.createBlock({
			localDateKey: DATE_KEY,
			blockType: "MEETING",
			startMinute: 540,
			durationMinutes: 30,
		});

		await expect(
			api.setBlockFocusTask({ blockId: meeting.id, taskId: 1 }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
		});
		await expect(
			api.createBlock({
				localDateKey: DATE_KEY,
				blockType: "FOCUS",
				startMinute: 600,
				durationMinutes: 30,
				metaLabel: "Should not stick",
			}),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_ATTACHMENT_TYPE_MESSAGE,
		});
	});

	it("rejects a 51st context tag for the same user", async () => {
		const api = caller(USER_A);
		for (let index = 0; index < MAX_CONTEXT_TAGS_PER_USER; index += 1) {
			seedContextTag({
				id: index + 1,
				userId: USER_A,
				label: `Tag ${index + 1}`,
			});
		}

		await expect(
			api.createContextTag({ label: "Overflow" }),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: SCHEDULE_TAG_CAP_MESSAGE,
		});
	});
});
