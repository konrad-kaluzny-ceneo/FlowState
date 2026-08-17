import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature: day-schedule-timeline, Property: Schedule block query isolation
 * Validates: two users with the same localDateKey cannot see each other's blocks.
 */

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

vi.mock("~/server/db/index", async () => {
	const { scheduleTestDb } = await import("./day-plan-schedule.test-db");
	return { db: scheduleTestDb };
});

import { atModOrThrow, atOrThrow } from "~/test-utils/array-access";
import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { dayPlanRouter } = await import("~/server/api/routers/day-plan");
const { db } = await import("~/server/db/index");
const { resetScheduleTestDb, seedScheduleBlock } = await import(
	"./day-plan-schedule.test-db"
);

const createCaller = createCallerFactory(dayPlanRouter);

const USER_A = "schedule-iso-a";
const USER_B = "schedule-iso-b";
const DATE_KEY = "2026-08-17";

function scheduleCaller(userId: string) {
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

const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: day-schedule-timeline, schedule block isolation", () => {
	beforeEach(() => {
		resetScheduleTestDb();
	});

	it("two users on the same localDateKey cannot see each other's blocks", async () => {
		await scheduleCaller(USER_A).createBlock({
			localDateKey: DATE_KEY,
			blockType: "FOCUS",
			startMinute: 540,
			durationMinutes: 30,
		});
		await scheduleCaller(USER_B).createBlock({
			localDateKey: DATE_KEY,
			blockType: "MEETING",
			startMinute: 540,
			durationMinutes: 30,
		});

		const listA = await scheduleCaller(USER_A).listBlocks({
			localDateKey: DATE_KEY,
		});
		const listB = await scheduleCaller(USER_B).listBlocks({
			localDateKey: DATE_KEY,
		});

		expect(listA).toHaveLength(1);
		expect(listA[0]?.userId).toBe(USER_A);
		expect(listA[0]?.blockType).toBe("FOCUS");
		expect(listB).toHaveLength(1);
		expect(listB[0]?.userId).toBe(USER_B);
		expect(listB[0]?.blockType).toBe("MEETING");
	});

	it("denies cross-user update, delete, and context-tag access", async () => {
		const created = await scheduleCaller(USER_B).createBlock({
			localDateKey: DATE_KEY,
			blockType: "BREAK",
			startMinute: 600,
			durationMinutes: 15,
		});
		const tag = await scheduleCaller(USER_B).createContextTag({
			label: "B only",
		});

		await expect(
			scheduleCaller(USER_A).updateBlock({
				blockId: created.id,
				startMinute: 630,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			scheduleCaller(USER_A).deleteBlock({ blockId: created.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			scheduleCaller(USER_A).deleteContextTag({ tagId: tag.id }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const tagsA = await scheduleCaller(USER_A).listContextTags();
		expect(tagsA).toEqual([]);

		const stillThere = await scheduleCaller(USER_B).listBlocks({
			localDateKey: DATE_KEY,
		});
		expect(stillThere).toHaveLength(1);
		expect(stillThere[0]?.startMinute).toBe(600);
	});

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 50 },
	)(
		"each user only sees their own blocks when querying the same date",
		async (userIds, querierSeed) => {
			resetScheduleTestDb();
			const querierId = atOrThrow(userIds, querierSeed % userIds.length);
			const blockCount = 4 + (querierSeed % 8);

			for (let index = 0; index < blockCount; index += 1) {
				const ownerId = atModOrThrow(userIds, index);
				seedScheduleBlock({
					id: index + 1,
					userId: ownerId,
					localDateKey: DATE_KEY,
					blockType: "FOCUS",
					startMinute: 360 + index * 15,
					durationMinutes: 15,
					metaLabel: null,
					fixedContext: null,
					customContextTagId: null,
					focusTaskId: null,
				});
			}

			const result = await scheduleCaller(querierId).listBlocks({
				localDateKey: DATE_KEY,
			});

			for (const block of result) {
				expect(block.userId).toBe(querierId);
			}

			const expectedCount = Array.from({ length: blockCount }).filter(
				(_, index) => atModOrThrow(userIds, index) === querierId,
			).length;
			expect(result).toHaveLength(expectedCount);
		},
	);
});
