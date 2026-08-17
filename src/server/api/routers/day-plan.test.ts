import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type Energy = "FOCUSED" | "STEADY" | "FADING";
type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
type CommitmentHorizon = "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";

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

type TaskRow = {
	id: number;
	title: string;
	status: string;
	userId: string;
	workType: WorkType;
	weight: number;
	importance: number;
	urgency: number;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	sortOrder: number;
	resumeNote: string | null;
	project: string | null;
	personaPresetId: string | null;
	isDailyStanding: boolean;
	archivedAt: Date | null;
	createdAt: Date;
	updatedAt: Date | null;
};

type TaskDelegationSkipRow = {
	id: number;
	userId: string;
	taskId: number;
	localDateKey: string;
	skippedAt: Date;
};

let dayPlans: DayPlanRow[] = [];
let nextDayPlanId = 1;
let tasks: TaskRow[] = [];
let taskDelegationSkips: TaskDelegationSkipRow[] = [];
let nextTaskDelegationSkipId = 1;

function mkTaskRow(overrides: Partial<TaskRow> & Pick<TaskRow, "id">): TaskRow {
	return {
		title: `Task ${overrides.id}`,
		status: "active",
		userId: USER_A,
		workType: "OPERATIONAL",
		weight: 2,
		importance: 2,
		urgency: 2,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		sortOrder: overrides.id,
		resumeNote: null,
		project: null,
		personaPresetId: null,
		isDailyStanding: false,
		archivedAt: null,
		createdAt: new Date("2026-01-01"),
		updatedAt: null,
		...overrides,
	};
}

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
		task: {
			findMany: vi.fn(
				(args: { where: { userId: string; status?: { in: string[] } } }) => {
					const { userId, status } = args.where;
					const matches = tasks.filter((task) => {
						if (task.userId !== userId) {
							return false;
						}
						if (status?.in != null && !status.in.includes(task.status)) {
							return false;
						}
						return true;
					});
					matches.sort((a, b) => {
						if (a.sortOrder !== b.sortOrder) {
							return a.sortOrder - b.sortOrder;
						}
						return a.createdAt.getTime() - b.createdAt.getTime();
					});
					return Promise.resolve(matches);
				},
			),
			findFirst: vi.fn((args: { where: { id: number; userId: string } }) => {
				const row = tasks.find(
					(task) =>
						task.id === args.where.id && task.userId === args.where.userId,
				);
				return Promise.resolve(row ?? null);
			}),
		},
		taskDayCompletion: {
			findMany: vi.fn(() => Promise.resolve([])),
		},
		taskDelegationSkip: {
			findMany: vi.fn(
				(args: { where: { userId: string; localDateKey: string } }) => {
					const { userId, localDateKey } = args.where;
					const matches = taskDelegationSkips.filter(
						(row) => row.userId === userId && row.localDateKey === localDateKey,
					);
					return Promise.resolve(matches);
				},
			),
			upsert: vi.fn(
				(args: {
					where: {
						task_delegation_skip_user_task_date: {
							userId: string;
							taskId: number;
							localDateKey: string;
						};
					};
					create: { userId: string; taskId: number; localDateKey: string };
					update: Record<string, never>;
				}) => {
					const { userId, taskId, localDateKey } =
						args.where.task_delegation_skip_user_task_date;
					const existing = taskDelegationSkips.find(
						(row) =>
							row.userId === userId &&
							row.taskId === taskId &&
							row.localDateKey === localDateKey,
					);
					if (existing) {
						return Promise.resolve(existing);
					}
					const row: TaskDelegationSkipRow = {
						id: nextTaskDelegationSkipId++,
						userId: args.create.userId,
						taskId: args.create.taskId,
						localDateKey: args.create.localDateKey,
						skippedAt: new Date(),
					};
					taskDelegationSkips.push(row);
					return Promise.resolve(row);
				},
			),
		},
		scheduleBlock: {
			findMany: vi.fn(() => Promise.resolve([])),
		},
		userContextTag: {
			findMany: vi.fn(() => Promise.resolve([])),
		},
		$transaction: vi.fn(
			async (
				arg:
					| Promise<unknown>[]
					| ((tx: typeof import("~/server/db/index").db) => unknown),
			) => {
				if (Array.isArray(arg)) {
					return Promise.all(arg);
				}
				return arg((await import("~/server/db/index")).db);
			},
		),
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
		tasks = [];
		taskDelegationSkips = [];
		nextTaskDelegationSkipId = 1;
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

	describe("getDelegationSuggestion", () => {
		it("returns the correct top candidate and never DEEP_WORK", async () => {
			tasks = [
				mkTaskRow({
					id: 1,
					status: "active",
					workType: "DEEP_WORK",
					importance: 1,
					urgency: 1,
				}),
				mkTaskRow({
					id: 2,
					status: "active",
					workType: "OPERATIONAL",
					importance: 2,
					urgency: 2,
					effortMinutes: 20,
					commitmentHorizon: "WHEN_POSSIBLE",
				}),
				mkTaskRow({
					id: 3,
					status: "active",
					workType: "REACTIVE",
					importance: 3,
					urgency: 3,
					effortMinutes: 90,
					commitmentHorizon: "ASAP",
				}),
			];

			const result = await dayPlanCaller(USER_A).getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});

			expect(result.status).toBe("ok");
			if (result.status === "ok") {
				expect(result.task.id).toBe(2);
				expect(result.task.workType).not.toBe("DEEP_WORK");
				expect(result.rationaleKey).toBe("delegation_low_effort");
				expect(result.rationale.length).toBeGreaterThan(0);
			}
		});

		it("respects skip records for the given localDateKey", async () => {
			tasks = [
				mkTaskRow({
					id: 1,
					status: "active",
					workType: "OPERATIONAL",
					importance: 2,
					urgency: 2,
					effortMinutes: 20,
					commitmentHorizon: "WHEN_POSSIBLE",
				}),
				mkTaskRow({
					id: 2,
					status: "active",
					workType: "OPERATIONAL",
					importance: 2,
					urgency: 2,
					effortMinutes: 60,
					commitmentHorizon: "THIS_WEEK",
				}),
			];
			taskDelegationSkips = [
				{
					id: nextTaskDelegationSkipId++,
					userId: USER_A,
					taskId: 1,
					localDateKey: DATE_KEY,
					skippedAt: new Date(),
				},
			];

			const result = await dayPlanCaller(USER_A).getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});

			expect(result.status).toBe("ok");
			if (result.status === "ok") {
				expect(result.task.id).toBe(2);
			}
		});

		it("returns empty when the candidate pool is exhausted", async () => {
			tasks = [mkTaskRow({ id: 1, status: "active", workType: "DEEP_WORK" })];

			const result = await dayPlanCaller(USER_A).getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});

			expect(result).toEqual({ status: "empty" });
		});

		it("returns empty when there are no tasks at all", async () => {
			const result = await dayPlanCaller(USER_A).getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});

			expect(result).toEqual({ status: "empty" });
		});

		it("does not leak candidates across users", async () => {
			tasks = [
				mkTaskRow({
					id: 1,
					userId: USER_A,
					status: "active",
					workType: "OPERATIONAL",
				}),
			];

			const result = await dayPlanCaller(USER_B).getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});

			expect(result).toEqual({ status: "empty" });
		});
	});

	describe("skipDelegationSuggestion", () => {
		it("persists a skip record", async () => {
			tasks = [mkTaskRow({ id: 1, userId: USER_A, status: "active" })];

			await dayPlanCaller(USER_A).skipDelegationSuggestion({
				localDateKey: DATE_KEY,
				taskId: 1,
			});

			expect(taskDelegationSkips).toMatchObject([
				{ userId: USER_A, taskId: 1, localDateKey: DATE_KEY },
			]);
		});

		it("is idempotent when the same task is skipped twice", async () => {
			tasks = [mkTaskRow({ id: 1, userId: USER_A, status: "active" })];

			await dayPlanCaller(USER_A).skipDelegationSuggestion({
				localDateKey: DATE_KEY,
				taskId: 1,
			});
			await expect(
				dayPlanCaller(USER_A).skipDelegationSuggestion({
					localDateKey: DATE_KEY,
					taskId: 1,
				}),
			).resolves.toBeUndefined();

			expect(taskDelegationSkips).toHaveLength(1);
		});

		it("throws NOT_FOUND for a taskId the caller doesn't own", async () => {
			tasks = [mkTaskRow({ id: 1, userId: USER_B, status: "active" })];

			await expect(
				dayPlanCaller(USER_A).skipDelegationSuggestion({
					localDateKey: DATE_KEY,
					taskId: 1,
				}),
			).rejects.toMatchObject({ code: "NOT_FOUND" });

			expect(taskDelegationSkips).toHaveLength(0);
		});

		it("advances getDelegationSuggestion to the next candidate after a skip", async () => {
			tasks = [
				mkTaskRow({
					id: 1,
					status: "active",
					workType: "OPERATIONAL",
					importance: 2,
					urgency: 2,
					effortMinutes: 20,
					commitmentHorizon: "WHEN_POSSIBLE",
				}),
				mkTaskRow({
					id: 2,
					status: "active",
					workType: "OPERATIONAL",
					importance: 2,
					urgency: 2,
					effortMinutes: 60,
					commitmentHorizon: "THIS_WEEK",
				}),
			];

			const caller = dayPlanCaller(USER_A);
			const first = await caller.getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});
			expect(first.status).toBe("ok");
			if (first.status !== "ok") {
				throw new Error("expected ok status");
			}
			expect(first.task.id).toBe(1);

			await caller.skipDelegationSuggestion({
				localDateKey: DATE_KEY,
				taskId: 1,
			});

			const second = await caller.getDelegationSuggestion({
				localDateKey: DATE_KEY,
			});
			expect(second.status).toBe("ok");
			if (second.status === "ok") {
				expect(second.task.id).toBe(2);
			}
		});
	});

	describe("schedule procedures", () => {
		it("listBlocks returns an empty list when the day has no blocks", async () => {
			const result = await dayPlanCaller(USER_A).listBlocks({
				localDateKey: DATE_KEY,
			});
			expect(result).toEqual([]);
		});

		it("listContextTags returns an empty list when the user has no tags", async () => {
			const result = await dayPlanCaller(USER_A).listContextTags();
			expect(result).toEqual([]);
		});
	});
});
