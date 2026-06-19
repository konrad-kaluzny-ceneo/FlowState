import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type DayPlanRow = {
	id: number;
	userId: string;
	localDateKey: string;
	focusBudgetMinutes: number;
	usedFocusMinutes: number;
	createdAt: Date;
	updatedAt: Date;
};

let dayPlans: DayPlanRow[] = [];
let nextDayPlanId = 1;

vi.mock("~/server/db/index", () => ({
	db: {
		dayPlan: {
			findUnique: vi.fn(
				(args: {
					where: {
						day_plan_user_date_key: {
							userId: string;
							localDateKey: string;
						};
					};
				}) => {
					const { userId, localDateKey } = args.where.day_plan_user_date_key;
					const row = dayPlans.find(
						(p) => p.userId === userId && p.localDateKey === localDateKey,
					);
					return Promise.resolve(row ?? null);
				},
			),
			upsert: vi.fn(
				(args: {
					where: {
						day_plan_user_date_key: {
							userId: string;
							localDateKey: string;
						};
					};
					create: {
						userId: string;
						localDateKey: string;
						focusBudgetMinutes: number;
						usedFocusMinutes: number;
					};
					update: { focusBudgetMinutes: number };
				}) => {
					const { userId, localDateKey } = args.where.day_plan_user_date_key;
					const existing = dayPlans.find(
						(p) => p.userId === userId && p.localDateKey === localDateKey,
					);
					if (existing) {
						existing.focusBudgetMinutes = args.update.focusBudgetMinutes;
						existing.updatedAt = new Date();
						return Promise.resolve(existing);
					}
					const row: DayPlanRow = {
						id: nextDayPlanId++,
						userId: args.create.userId,
						localDateKey: args.create.localDateKey,
						focusBudgetMinutes: args.create.focusBudgetMinutes,
						usedFocusMinutes: args.create.usedFocusMinutes,
						createdAt: new Date(),
						updatedAt: new Date(),
					};
					dayPlans.push(row);
					return Promise.resolve(row);
				},
			),
			update: vi.fn(
				(args: {
					where: { id: number };
					data: { usedFocusMinutes: number };
				}) => {
					const row = dayPlans.find((p) => p.id === args.where.id);
					if (!row) {
						throw new Error("Day plan not found");
					}
					row.usedFocusMinutes = args.data.usedFocusMinutes;
					row.updatedAt = new Date();
					return Promise.resolve(row);
				},
			),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { dayPlanRouter } = await import("~/server/api/routers/day-plan");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(dayPlanRouter);

const USER_A = "day-plan-user-a";
const USER_B = "day-plan-user-b";
const DATE_KEY = "2026-06-19";

function dayPlanCaller(userId: string) {
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

describe("dayPlan router", () => {
	beforeEach(() => {
		dayPlans = [];
		nextDayPlanId = 1;
	});

	it("getOrCreate returns null budget when no row exists", async () => {
		const result = await dayPlanCaller(USER_A).getOrCreate({
			localDateKey: DATE_KEY,
		});

		expect(result).toEqual({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: null,
			usedFocusMinutes: 0,
			remainingFocusMinutes: null,
		});
	});

	it("setBudget upserts and getOrCreate returns remaining minutes", async () => {
		const caller = dayPlanCaller(USER_A);

		await caller.setBudget({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 120,
		});

		const result = await caller.getOrCreate({ localDateKey: DATE_KEY });

		expect(result).toEqual({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 120,
			usedFocusMinutes: 0,
			remainingFocusMinutes: 120,
		});
	});

	it("setBudget rejects out-of-range focus budget", async () => {
		await expect(
			dayPlanCaller(USER_A).setBudget({
				localDateKey: DATE_KEY,
				focusBudgetMinutes: 10,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("setBudget clamps used minutes when budget decreases", async () => {
		dayPlans.push({
			id: nextDayPlanId++,
			userId: USER_A,
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 120,
			usedFocusMinutes: 90,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const result = await dayPlanCaller(USER_A).setBudget({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 60,
		});

		expect(result).toMatchObject({
			focusBudgetMinutes: 60,
			usedFocusMinutes: 60,
			remainingFocusMinutes: 0,
		});
	});

	it("setBudget for one user does not affect another user", async () => {
		await dayPlanCaller(USER_A).setBudget({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 120,
		});

		const other = await dayPlanCaller(USER_B).getOrCreate({
			localDateKey: DATE_KEY,
		});

		expect(other.focusBudgetMinutes).toBeNull();
	});
});
