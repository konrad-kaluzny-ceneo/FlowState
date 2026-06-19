import { beforeEach, describe, expect, it, vi } from "vitest";

import { incrementUsedFocusMinutes } from "./increment-used-focus-minutes";

type DayPlanRow = {
	id: number;
	userId: string;
	localDateKey: string;
	focusBudgetMinutes: number;
	usedFocusMinutes: number;
};

let dayPlans: DayPlanRow[] = [];
let nextId = 1;

const db = {
	dayPlan: {
		findUnique: vi.fn(
			(args: {
				where:
					| { id: number }
					| {
							day_plan_user_date_key: {
								userId: string;
								localDateKey: string;
							};
					  };
			}) => {
				if ("id" in args.where) {
					const whereById = args.where;
					return Promise.resolve(
						dayPlans.find((row) => row.id === whereById.id) ?? null,
					);
				}
				const { userId, localDateKey } = args.where.day_plan_user_date_key;
				return Promise.resolve(
					dayPlans.find(
						(row) => row.userId === userId && row.localDateKey === localDateKey,
					) ?? null,
				);
			},
		),
		update: vi.fn(
			(args: {
				where: { id: number };
				data:
					| { usedFocusMinutes: number }
					| { usedFocusMinutes: { increment: number } };
			}) => {
				const row = dayPlans.find((item) => item.id === args.where.id);
				if (!row) {
					throw new Error("not found");
				}
				const used = args.data.usedFocusMinutes;
				if (typeof used === "object" && used !== null && "increment" in used) {
					row.usedFocusMinutes += used.increment;
				} else if (typeof used === "number") {
					row.usedFocusMinutes = used;
				}
				return Promise.resolve({ ...row });
			},
		),
	},
};

describe("incrementUsedFocusMinutes", () => {
	beforeEach(() => {
		dayPlans = [
			{
				id: nextId++,
				userId: "user-a",
				localDateKey: "2026-06-19",
				focusBudgetMinutes: 60,
				usedFocusMinutes: 0,
			},
		];
		vi.clearAllMocks();
	});

	it("adds minutes and returns updated totals", async () => {
		const result = await incrementUsedFocusMinutes(
			db as never,
			"user-a",
			"2026-06-19",
			25,
		);

		expect(result).toEqual({
			usedFocusMinutes: 25,
			focusBudgetMinutes: 60,
		});
	});

	it("caps used minutes at budget", async () => {
		const row = dayPlans[0];
		if (row) {
			row.usedFocusMinutes = 45;
		}

		const result = await incrementUsedFocusMinutes(
			db as never,
			"user-a",
			"2026-06-19",
			30,
		);

		expect(result).toEqual({
			usedFocusMinutes: 60,
			focusBudgetMinutes: 60,
		});
	});

	it("returns null when day plan is missing", async () => {
		const result = await incrementUsedFocusMinutes(
			db as never,
			"user-a",
			"2026-06-20",
			10,
		);

		expect(result).toBeNull();
	});
});
