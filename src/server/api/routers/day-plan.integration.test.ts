import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { dayPlanRouter } = await import("~/server/api/routers/day-plan");

const createCaller = createCallerFactory(dayPlanRouter);

const USER = "day-plan-integration-user";
const OTHER_USER = "day-plan-integration-other";

function todayLocalDateKey() {
	const now = new Date();
	return [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");
}

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

// Guards the "without a cycle" contract: the energy-of-the-day path must never
// reach the cycle/check-in tables. Any call fails the test loudly.
const checkInCreate = vi.fn(() => {
	throw new Error("energy-of-the-day path must not create a CheckIn");
});
const cycleCreate = vi.fn(() => {
	throw new Error("energy-of-the-day path must not create a Cycle");
});

function createMockDb() {
	return {
		dayPlan: {
			findUnique: vi.fn(
				(args: {
					where: {
						day_plan_user_date_key: { userId: string; localDateKey: string };
					};
				}) => {
					const { userId, localDateKey } = args.where.day_plan_user_date_key;
					return Promise.resolve(
						dayPlans.find(
							(p) => p.userId === userId && p.localDateKey === localDateKey,
						) ?? null,
					);
				},
			),
			upsert: vi.fn(
				(args: {
					where: {
						day_plan_user_date_key: { userId: string; localDateKey: string };
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
		cycle: { create: cycleCreate },
		checkIn: { create: checkInCreate },
	};
}

function dayPlanCaller(userId: string, db: ReturnType<typeof createMockDb>) {
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

describe("dayPlan energy-of-the-day integration", () => {
	beforeEach(() => {
		dayPlans = [];
		nextDayPlanId = 1;
		checkInCreate.mockClear();
		cycleCreate.mockClear();
	});

	// Manual verification 1.5: setTodayEnergy creates/updates energy for today
	// without a cycle or budget.
	it("records today's energy at day start without any cycle or budget", async () => {
		const localDateKey = todayLocalDateKey();
		const db = createMockDb();
		const caller = dayPlanCaller(USER, db);

		const setResult = await caller.setEnergy({
			localDateKey,
			energy: "FOCUSED",
		});

		expect(setResult).toEqual({ localDateKey, energyLevel: "FOCUSED" });

		// A day-plan row now exists carrying energy only — no budget was set.
		const stored = dayPlans.find(
			(p) => p.userId === USER && p.localDateKey === localDateKey,
		);
		expect(stored?.energyLevel).toBe("FOCUSED");
		expect(stored?.focusBudgetMinutes).toBeNull();

		// The energy path stayed decoupled from cycles/check-ins.
		expect(cycleCreate).not.toHaveBeenCalled();
		expect(checkInCreate).not.toHaveBeenCalled();
	});

	// Manual verification 1.6: getTodayEnergy returns the last-saved energy for
	// today's date key.
	it("reads back the energy saved for today's date key", async () => {
		const localDateKey = todayLocalDateKey();
		const db = createMockDb();
		const caller = dayPlanCaller(USER, db);

		await caller.setEnergy({ localDateKey, energy: "STEADY" });

		const readBack = await caller.getOrCreate({ localDateKey });
		expect(readBack).toEqual({
			localDateKey,
			focusBudgetMinutes: null,
			usedFocusMinutes: 0,
			remainingFocusMinutes: null,
			energyLevel: "STEADY",
		});
	});

	// 1.5 update path: editing energy later (e.g. from settings) overwrites it.
	it("overwrites the day's energy when changed again", async () => {
		const localDateKey = todayLocalDateKey();
		const db = createMockDb();
		const caller = dayPlanCaller(USER, db);

		await caller.setEnergy({ localDateKey, energy: "FOCUSED" });
		await caller.setEnergy({ localDateKey, energy: "FADING" });

		const readBack = await caller.getOrCreate({ localDateKey });
		expect(readBack.energyLevel).toBe("FADING");
		// Still a single row — upsert, not insert-per-edit.
		expect(dayPlans).toHaveLength(1);
	});

	// Energy and budget must coexist on the same per-day record, either order.
	it("keeps energy and budget independent on the same day record", async () => {
		const localDateKey = todayLocalDateKey();
		const db = createMockDb();
		const caller = dayPlanCaller(USER, db);

		await caller.setBudget({ localDateKey, focusBudgetMinutes: 180 });
		await caller.setEnergy({ localDateKey, energy: "STEADY" });

		const afterEnergy = await caller.getOrCreate({ localDateKey });
		expect(afterEnergy).toEqual({
			localDateKey,
			focusBudgetMinutes: 180,
			usedFocusMinutes: 0,
			remainingFocusMinutes: 180,
			energyLevel: "STEADY",
		});

		// Changing the budget afterwards leaves energy untouched.
		await caller.setBudget({ localDateKey, focusBudgetMinutes: 60 });
		const afterBudget = await caller.getOrCreate({ localDateKey });
		expect(afterBudget.energyLevel).toBe("STEADY");
		expect(afterBudget.focusBudgetMinutes).toBe(60);
	});

	// Energy is scoped to the local date key and to the user.
	it("scopes energy to today's date key and to the user", async () => {
		const localDateKey = todayLocalDateKey();
		const db = createMockDb();

		await dayPlanCaller(USER, db).setEnergy({
			localDateKey,
			energy: "FOCUSED",
		});

		const otherDay = await dayPlanCaller(USER, db).getOrCreate({
			localDateKey: "1999-01-01",
		});
		expect(otherDay.energyLevel).toBeNull();

		const otherUser = await dayPlanCaller(OTHER_USER, db).getOrCreate({
			localDateKey,
		});
		expect(otherUser.energyLevel).toBeNull();
	});
});
