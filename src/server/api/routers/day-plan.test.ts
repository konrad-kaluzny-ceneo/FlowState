import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type Energy = "FOCUSED" | "STEADY" | "FADING";

type DayPlanRow = {
	id: number;
	userId: string;
	localDateKey: string;
	focusBudgetMinutes: number | null;
	usedFocusMinutes: number;
	energyLevel: Energy | null;
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
						focusBudgetMinutes?: number;
						usedFocusMinutes: number;
						energyLevel?: Energy;
					};
					update: { focusBudgetMinutes?: number; energyLevel?: Energy };
				}) => {
					const { userId, localDateKey } = args.where.day_plan_user_date_key;
					const existing = dayPlans.find(
						(p) => p.userId === userId && p.localDateKey === localDateKey,
					);
					if (existing) {
						if (args.update.focusBudgetMinutes !== undefined) {
							existing.focusBudgetMinutes = args.update.focusBudgetMinutes;
						}
						if (args.update.energyLevel !== undefined) {
							existing.energyLevel = args.update.energyLevel;
						}
						existing.updatedAt = new Date();
						return Promise.resolve(existing);
					}
					const row: DayPlanRow = {
						id: nextDayPlanId++,
						userId: args.create.userId,
						localDateKey: args.create.localDateKey,
						focusBudgetMinutes: args.create.focusBudgetMinutes ?? null,
						usedFocusMinutes: args.create.usedFocusMinutes,
						energyLevel: args.create.energyLevel ?? null,
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

	it("getOrCreate returns null budget and null energy when no row exists", async () => {
		const result = await dayPlanCaller(USER_A).getOrCreate({
			localDateKey: DATE_KEY,
		});

		expect(result).toEqual({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: null,
			usedFocusMinutes: 0,
			remainingFocusMinutes: null,
			energyLevel: null,
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
			energyLevel: null,
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
			energyLevel: null,
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

	it("setEnergy creates an energy-only day plan without a budget", async () => {
		const caller = dayPlanCaller(USER_A);

		const setResult = await caller.setEnergy({
			localDateKey: DATE_KEY,
			energy: "FOCUSED",
		});

		expect(setResult).toEqual({
			localDateKey: DATE_KEY,
			energyLevel: "FOCUSED",
		});

		const result = await caller.getOrCreate({ localDateKey: DATE_KEY });
		expect(result).toEqual({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: null,
			usedFocusMinutes: 0,
			remainingFocusMinutes: null,
			energyLevel: "FOCUSED",
		});
	});

	it("setEnergy overwrites a previously stored energy", async () => {
		const caller = dayPlanCaller(USER_A);

		await caller.setEnergy({ localDateKey: DATE_KEY, energy: "FOCUSED" });
		await caller.setEnergy({ localDateKey: DATE_KEY, energy: "FADING" });

		const result = await caller.getOrCreate({ localDateKey: DATE_KEY });
		expect(result.energyLevel).toBe("FADING");
	});

	it("setEnergy preserves an existing budget and vice versa", async () => {
		const caller = dayPlanCaller(USER_A);

		await caller.setBudget({ localDateKey: DATE_KEY, focusBudgetMinutes: 120 });
		await caller.setEnergy({ localDateKey: DATE_KEY, energy: "STEADY" });

		const result = await caller.getOrCreate({ localDateKey: DATE_KEY });
		expect(result).toEqual({
			localDateKey: DATE_KEY,
			focusBudgetMinutes: 120,
			usedFocusMinutes: 0,
			remainingFocusMinutes: 120,
			energyLevel: "STEADY",
		});
	});

	it("setEnergy rejects an invalid energy value", async () => {
		await expect(
			dayPlanCaller(USER_A).setEnergy({
				localDateKey: DATE_KEY,
				energy: "SUPERCHARGED" as never,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("setEnergy for one user does not affect another user", async () => {
		await dayPlanCaller(USER_A).setEnergy({
			localDateKey: DATE_KEY,
			energy: "FOCUSED",
		});

		const other = await dayPlanCaller(USER_B).getOrCreate({
			localDateKey: DATE_KEY,
		});

		expect(other.energyLevel).toBeNull();
	});
});
