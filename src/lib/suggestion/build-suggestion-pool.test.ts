import { describe, expect, it, vi } from "vitest";

import {
	buildSuggestionPool,
	getDoneTodayTaskIds,
} from "~/lib/suggestion/build-suggestion-pool";

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date | null;
	isDailyStanding: boolean;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance: number;
	urgency: number;
	effortMinutes: number | null;
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	personaPresetId: string | null;
	archivedAt: Date | null;
};

const USER_ID = "suggestion-pool-user";
const LOCAL_DATE_KEY = "2026-06-19";

function makeTask(
	overrides: Partial<TaskRow> & Pick<TaskRow, "id" | "title" | "status">,
): TaskRow {
	return {
		userId: USER_ID,
		sortOrder: overrides.id,
		createdAt: new Date("2026-01-01"),
		updatedAt: null,
		isDailyStanding: false,
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		personaPresetId: null,
		archivedAt: null,
		...overrides,
	};
}

function createDb(tasks: TaskRow[]) {
	return {
		task: {
			findMany: vi.fn(
				(args: {
					where: {
						userId?: string;
						status?: { not: string };
						OR?: Array<{ status?: string; isDailyStanding?: boolean }>;
					};
				}) => {
					return Promise.resolve(
						tasks.filter((task) => {
							if (
								args.where.userId != null &&
								task.userId !== args.where.userId
							) {
								return false;
							}
							if (
								args.where.status?.not != null &&
								task.status === args.where.status.not
							) {
								return false;
							}
							if (args.where.OR != null) {
								const matches = args.where.OR.some((clause) => {
									if (clause.status != null && task.status === clause.status) {
										return true;
									}
									return (
										clause.isDailyStanding === true && task.isDailyStanding
									);
								});
								if (!matches) {
									return false;
								}
							}
							return true;
						}),
					);
				},
			),
		},
		taskDayCompletion: {
			findMany: vi.fn(() => Promise.resolve([])),
		},
	} as never;
}

describe("buildSuggestionPool archive exclusion", () => {
	it("excludes archived active tasks", async () => {
		const tasks = [
			makeTask({ id: 1, title: "Fresh", status: "active" }),
			makeTask({ id: 2, title: "Stale archived", status: "archived" }),
		];
		const db = createDb(tasks);

		const pool = await buildSuggestionPool(db, USER_ID, LOCAL_DATE_KEY);

		expect(pool.map((task) => task.id)).toEqual([1]);
	});

	it("excludes archived daily-standing tasks", async () => {
		const tasks = [
			makeTask({
				id: 1,
				title: "Standing archived",
				status: "archived",
				isDailyStanding: true,
			}),
			makeTask({
				id: 2,
				title: "Standing active",
				status: "active",
				isDailyStanding: true,
			}),
		];
		const db = createDb(tasks);

		const pool = await buildSuggestionPool(db, USER_ID, LOCAL_DATE_KEY);

		expect(pool.map((task) => task.id)).toEqual([2]);
	});

	it("keeps eligible non-archived daily-standing tasks unless done today", async () => {
		const tasks = [
			makeTask({
				id: 1,
				title: "Standing",
				status: "completed",
				isDailyStanding: true,
			}),
		];
		const db = createDb(tasks);
		const doneTodayIds = new Set([1]);

		const pool = await buildSuggestionPool(
			db,
			USER_ID,
			LOCAL_DATE_KEY,
			doneTodayIds,
		);

		expect(pool).toHaveLength(0);
	});

	it("getDoneTodayTaskIds returns completion ids", async () => {
		const db = {
			taskDayCompletion: {
				findMany: vi.fn(() => Promise.resolve([{ taskId: 7 }, { taskId: 9 }])),
			},
		} as never;

		const ids = await getDoneTodayTaskIds(db, USER_ID, LOCAL_DATE_KEY);

		expect(ids).toEqual(new Set([7, 9]));
	});
});
