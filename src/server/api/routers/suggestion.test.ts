import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type EnergyLevel = "FOCUSED" | "STEADY" | "FADING";
type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
type SuggestionContext = "POST_CHECK_IN" | "KICKOFF";
type SessionState = "ACTIVE" | "ENDED_BY_USER" | "ENDED_BY_TIMEOUT";

type CycleRow = {
	id: number;
	sessionId: number;
	userId: string;
	kind: string;
	state: string;
};

type SessionRow = {
	id: number;
	userId: string;
	interruptionCount: number;
	state: SessionState;
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
	commitmentHorizon: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	createdAt: Date;
	personaPresetId?: string | null;
	isDailyStanding: boolean;
};

type TaskDayCompletionRow = {
	userId: string;
	taskId: number;
	localDateKey: string;
};

type DayPlanRow = {
	userId: string;
	localDateKey: string;
	focusBudgetMinutes: number;
	usedFocusMinutes: number;
};

const LOCAL_DATE_KEY = "2026-06-19";

function taskDefaults(
	weight: number,
): Pick<
	TaskRow,
	| "importance"
	| "urgency"
	| "effortMinutes"
	| "commitmentHorizon"
	| "weight"
	| "isDailyStanding"
> {
	return {
		weight,
		importance: 2,
		urgency: weight,
		effortMinutes: null,
		commitmentHorizon: "WHEN_POSSIBLE",
		isDailyStanding: false,
	};
}

type CheckInRow = {
	cycleId: number;
	userId: string;
	energy: EnergyLevel;
};

type DecisionRow = {
	id: number;
	cycleId: number | null;
	sessionId: number | null;
	context: SuggestionContext;
	userId: string;
	suggestedTaskId: number;
	chosenTaskId: number;
	accepted: boolean;
	createdAt: Date;
	chosenTask: TaskRow;
};

let cycles: CycleRow[] = [];
let sessions: SessionRow[] = [];
let tasks: TaskRow[] = [];
let checkIns: CheckInRow[] = [];
let decisions: DecisionRow[] = [];
let taskDayCompletions: TaskDayCompletionRow[] = [];
let dayPlans: DayPlanRow[] = [];
let nextDecisionId = 1;

function matchesLastOverrideWhere(
	decision: DecisionRow,
	where: {
		userId?: string;
		accepted?: boolean;
		OR?: Array<
			| { cycle?: { sessionId?: number } }
			| { sessionId?: number; context?: SuggestionContext }
		>;
	},
): boolean {
	if (where.userId != null && decision.userId !== where.userId) {
		return false;
	}
	if (where.accepted != null && decision.accepted !== where.accepted) {
		return false;
	}
	if (where.OR != null) {
		const matchesOr = where.OR.some((clause) => {
			if ("cycle" in clause && clause.cycle?.sessionId != null) {
				const cycle = cycles.find((c) => c.id === decision.cycleId);
				return cycle?.sessionId === clause.cycle.sessionId;
			}
			if ("sessionId" in clause && clause.sessionId != null) {
				return (
					decision.sessionId === clause.sessionId &&
					(clause.context == null || decision.context === clause.context)
				);
			}
			return false;
		});
		if (!matchesOr) {
			return false;
		}
	}
	return true;
}

vi.mock("~/server/db/index", () => ({
	db: {
		cycle: {
			findFirst: vi.fn(
				(args: {
					where: { id?: number; userId?: string };
					include?: { session?: boolean; checkIn?: boolean };
				}) => {
					const cycle = cycles.find(
						(c) => c.id === args.where.id && c.userId === args.where.userId,
					);
					if (!cycle) return Promise.resolve(null);
					const session = args.include?.session
						? (sessions.find((s) => s.id === cycle.sessionId) ?? null)
						: undefined;
					const checkIn = args.include?.checkIn
						? (checkIns.find((c) => c.cycleId === cycle.id) ?? null)
						: undefined;
					return Promise.resolve({
						...cycle,
						...(session != null ? { session } : {}),
						...(args.include?.checkIn ? { checkIn: checkIn ?? null } : {}),
					});
				},
			),
			count: vi.fn(
				(args: {
					where: {
						userId?: string;
						sessionId?: number;
						kind?: string;
						state?: string;
					};
				}) => {
					const n = cycles.filter((c) => {
						if (args.where.userId != null && c.userId !== args.where.userId)
							return false;
						if (
							args.where.sessionId != null &&
							c.sessionId !== args.where.sessionId
						)
							return false;
						if (args.where.kind != null && c.kind !== args.where.kind)
							return false;
						if (args.where.state != null && c.state !== args.where.state)
							return false;
						return true;
					}).length;
					return Promise.resolve(n);
				},
			),
		},
		session: {
			findFirst: vi.fn((args: { where: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					sessions.find(
						(s) => s.id === args.where.id && s.userId === args.where.userId,
					) ?? null,
				);
			}),
		},
		task: {
			findMany: vi.fn(
				(args: {
					where: {
						userId?: string;
						status?: string | { not: string; in?: string[] };
						OR?: Array<{ status?: string; isDailyStanding?: boolean }>;
					};
					orderBy?:
						| { createdAt: "asc" }
						| Array<{ sortOrder?: "asc"; createdAt?: "asc" }>;
				}) => {
					let rows = tasks.filter((t) => {
						if (args.where.userId != null && t.userId !== args.where.userId) {
							return false;
						}
						const statusFilter = args.where.status;
						if (statusFilter != null) {
							if (typeof statusFilter === "string") {
								if (t.status !== statusFilter) {
									return false;
								}
							} else if (Array.isArray(statusFilter.in)) {
								if (!statusFilter.in.includes(t.status)) {
									return false;
								}
							} else if (t.status === statusFilter.not) {
								return false;
							}
						}
						if (args.where.OR != null) {
							const matches = args.where.OR.some((clause) => {
								if (clause.status != null && t.status === clause.status) {
									return true;
								}
								return clause.isDailyStanding === true && t.isDailyStanding;
							});
							if (!matches) {
								return false;
							}
						}
						return true;
					});
					const orderBy = args.orderBy;
					if (Array.isArray(orderBy)) {
						rows = [...rows].sort((a, b) => {
							for (const clause of orderBy) {
								if (clause.sortOrder === "asc" && a.sortOrder !== b.sortOrder) {
									return a.sortOrder - b.sortOrder;
								}
								if (
									clause.createdAt === "asc" &&
									a.createdAt.getTime() !== b.createdAt.getTime()
								) {
									return a.createdAt.getTime() - b.createdAt.getTime();
								}
							}
							return 0;
						});
					} else if (orderBy?.createdAt === "asc") {
						rows = [...rows].sort(
							(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
						);
					}
					return Promise.resolve(rows);
				},
			),
			findFirst: vi.fn(
				(args: {
					where: {
						id?: number;
						userId?: string;
						status?: string;
					};
				}) => {
					return Promise.resolve(
						tasks.find((t) => {
							if (args.where.id != null && t.id !== args.where.id) {
								return false;
							}
							if (args.where.userId != null && t.userId !== args.where.userId) {
								return false;
							}
							if (args.where.status != null && t.status !== args.where.status) {
								return false;
							}
							return true;
						}) ?? null,
					);
				},
			),
		},
		checkIn: {
			findFirst: vi.fn(),
		},
		suggestionDecision: {
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						accepted?: boolean;
						cycle?: { sessionId?: number };
						OR?: Array<
							| { cycle?: { sessionId?: number } }
							| { sessionId?: number; context?: SuggestionContext }
						>;
					};
					orderBy?: { createdAt: "desc" };
					include?: { chosenTask: boolean };
				}) => {
					let rows = decisions.filter((d) =>
						matchesLastOverrideWhere(d, args.where),
					);
					if (args.orderBy?.createdAt === "desc") {
						rows = [...rows].sort(
							(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
						);
					}
					const row = rows[0] ?? null;
					if (row == null) return Promise.resolve(null);
					if (args.include?.chosenTask) {
						return Promise.resolve(row);
					}
					return Promise.resolve(row);
				},
			),
			upsert: vi.fn(
				(args: {
					where: { cycleId: number };
					create: Omit<DecisionRow, "id" | "createdAt" | "chosenTask">;
					update: Partial<
						Pick<
							DecisionRow,
							"suggestedTaskId" | "chosenTaskId" | "accepted" | "context"
						>
					>;
				}) => {
					const existing = decisions.find(
						(d) => d.cycleId === args.where.cycleId,
					);
					const chosenTask = tasks.find(
						(t) =>
							t.id === (args.create.chosenTaskId ?? existing?.chosenTaskId),
					);
					if (existing) {
						Object.assign(existing, args.update);
						if (chosenTask) existing.chosenTask = chosenTask;
						return Promise.resolve(existing);
					}
					const row: DecisionRow = {
						id: nextDecisionId++,
						...args.create,
						createdAt: new Date(),
						chosenTask: chosenTask as TaskRow,
					};
					decisions.push(row);
					return Promise.resolve(row);
				},
			),
			create: vi.fn(
				(args: {
					data: Omit<DecisionRow, "id" | "createdAt" | "chosenTask">;
				}) => {
					const chosenTask = tasks.find((t) => t.id === args.data.chosenTaskId);
					const row: DecisionRow = {
						id: nextDecisionId++,
						...args.data,
						createdAt: new Date(),
						chosenTask: chosenTask as TaskRow,
					};
					decisions.push(row);
					return Promise.resolve(row);
				},
			),
			count: vi.fn(
				(args: { where: { userId?: string; suggestedTaskId?: number } }) => {
					const n = decisions.filter((d) => {
						if (args.where.userId != null && d.userId !== args.where.userId) {
							return false;
						}
						if (
							args.where.suggestedTaskId != null &&
							d.suggestedTaskId !== args.where.suggestedTaskId
						) {
							return false;
						}
						return true;
					}).length;
					return Promise.resolve(n);
				},
			),
		},
		taskDayCompletion: {
			findMany: vi.fn(
				(args: { where: { userId?: string; localDateKey?: string } }) => {
					return Promise.resolve(
						taskDayCompletions.filter((row) => {
							if (
								args.where.userId != null &&
								row.userId !== args.where.userId
							) {
								return false;
							}
							if (
								args.where.localDateKey != null &&
								row.localDateKey !== args.where.localDateKey
							) {
								return false;
							}
							return true;
						}),
					);
				},
			),
		},
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
					return Promise.resolve(
						dayPlans.find(
							(plan) =>
								plan.userId === userId && plan.localDateKey === localDateKey,
						) ?? null,
					);
				},
			),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { suggestionRouter } = await import("~/server/api/routers/suggestion");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(suggestionRouter);
const USER_ID = "suggestion-user";

function expectBreakdownShape(
	result: {
		rationale: string;
		breakdown: {
			headline: string;
			dominant: Array<{ key: string; copy: string }>;
			alsoConsidered: string[];
		};
	} | null,
) {
	expect(result).not.toBeNull();
	if (result == null) return;
	expect(result.breakdown.headline).toBe(result.rationale);
	expect(result.breakdown.dominant.length).toBeGreaterThanOrEqual(0);
	expect(result.breakdown.dominant.length).toBeLessThanOrEqual(3);
	expect(result.breakdown.alsoConsidered.length).toBeLessThanOrEqual(4);
}

function caller(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: { id: userId, email: "test@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

function seedTasks() {
	tasks = [
		{
			id: 1,
			title: "Deep feature",
			status: "active",
			userId: USER_ID,
			workType: "DEEP_WORK",
			sortOrder: 0,
			createdAt: new Date("2026-01-01"),
			personaPresetId: null,
			...taskDefaults(3),
		},
		{
			id: 2,
			title: "Inbox",
			status: "active",
			userId: USER_ID,
			workType: "REACTIVE",
			sortOrder: 1,
			createdAt: new Date("2026-01-02"),
			personaPresetId: null,
			...taskDefaults(2),
		},
		{
			id: 3,
			title: "Ops queue",
			status: "active",
			userId: USER_ID,
			workType: "OPERATIONAL",
			sortOrder: 2,
			createdAt: new Date("2026-01-03"),
			personaPresetId: null,
			...taskDefaults(2),
		},
	];
}

describe("suggestion router", () => {
	beforeEach(() => {
		cycles = [];
		sessions = [];
		tasks = [];
		checkIns = [];
		decisions = [];
		taskDayCompletions = [];
		dayPlans = [];
		nextDecisionId = 1;
		vi.clearAllMocks();
	});

	it("next returns deep task when FOCUSED with mixed candidates", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FOCUSED" }];
		seedTasks();

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result).toMatchObject({
			taskId: 1,
			title: "Deep feature",
			workType: "DEEP_WORK",
		});
		expect(result?.rationale).toBeTruthy();
		expectBreakdownShape(result);
		expect(result?.rationaleKey).toBe("energy_deep");
		if (result?.breakdown.dominant[0] != null) {
			expect(result.breakdown.dominant[0].copy).not.toBe(result.rationale);
		}
	});

	it("next returns null when no active tasks", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		tasks = [];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});
		expect(result).toBeNull();
	});

	it("next throws NOT_FOUND for another user's cycle", async () => {
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: "other-user",
				kind: "WORK",
				state: "COMPLETED",
			},
		];

		await expect(
			caller().next({
				context: "post_check_in",
				cycleId: 10,
				localHour: 10,
				localDateKey: LOCAL_DATE_KEY,
			}),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("next throws BAD_REQUEST without check-in", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];

		await expect(
			caller().next({
				context: "post_check_in",
				cycleId: 10,
				localHour: 10,
				localDateKey: LOCAL_DATE_KEY,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("recordDecision stores accept vs override", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		tasks = [
			{
				id: 1,
				title: "A",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				sortOrder: 0,
				createdAt: new Date(),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "B",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 1,
				createdAt: new Date(),
				...taskDefaults(2),
			},
		];

		const accepted = await caller().recordDecision({
			context: "post_check_in",
			cycleId: 10,
			suggestedTaskId: 1,
			chosenTaskId: 1,
		});
		expect(accepted.accepted).toBe(true);
		expect(accepted.context).toBe("POST_CHECK_IN");

		const overridden = await caller().recordDecision({
			context: "post_check_in",
			cycleId: 10,
			suggestedTaskId: 1,
			chosenTaskId: 2,
		});
		expect(overridden.accepted).toBe(false);
	});

	it("recordDecision throws BAD_REQUEST without check-in", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		tasks = [
			{
				id: 1,
				title: "A",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				sortOrder: 0,
				createdAt: new Date(),
				...taskDefaults(2),
			},
		];

		await expect(
			caller().recordDecision({
				context: "post_check_in",
				cycleId: 10,
				suggestedTaskId: 1,
				chosenTaskId: 1,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("kickoff next returns suggestion without check-in using declared energy", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		seedTasks();

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result).toMatchObject({
			sessionId: 1,
			taskId: 1,
			workType: "DEEP_WORK",
			rationaleKey: "kickoff_fresh",
		});
		expect(result).not.toHaveProperty("cycleId");
		expectBreakdownShape(result);
	});

	it("kickoff next rejects missing energy", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		seedTasks();

		await expect(
			caller().next({
				context: "kickoff",
				sessionId: 1,
				localHour: 10,
			} as never),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("kickoff next picks different tasks for FOCUSED vs FADING on mixed pool", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		seedTasks();

		const focused = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "FOCUSED",
		});
		const fading = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "FADING",
		});

		expect(focused).toMatchObject({ taskId: 1, workType: "DEEP_WORK" });
		expect(fading).toMatchObject({ taskId: 2, workType: "REACTIVE" });
	});

	it("kickoff next prefers higher Eisenhower product when session context is equal", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		tasks = [
			{
				id: 1,
				title: "Low matrix score",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "High matrix score",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-02"),
				weight: 2,
				importance: 3,
				urgency: 2,
				effortMinutes: null,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: false,
			},
		];

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result).toMatchObject({
			taskId: 2,
			importance: 3,
			urgency: 2,
			commitmentHorizon: "WHEN_POSSIBLE",
		});
	});

	it("kickoff next uses kickoff_resume after completed work cycles", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		seedTasks();

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result?.rationaleKey).toBe("kickoff_resume");
		expectBreakdownShape(result);
	});

	it("kickoff recordDecision creates row without cycleId", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		seedTasks();

		const row = await caller().recordDecision({
			context: "kickoff",
			sessionId: 1,
			suggestedTaskId: 1,
			chosenTaskId: 2,
		});

		expect(row).toMatchObject({
			cycleId: null,
			sessionId: 1,
			context: "KICKOFF",
			accepted: false,
		});
	});

	it("kickoff next excludes daily-standing task marked done for today", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		taskDayCompletions = [
			{ userId: USER_ID, taskId: 2, localDateKey: LOCAL_DATE_KEY },
		];
		tasks = [
			{
				id: 1,
				title: "Active task",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "Standing done today",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-02"),
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: 15,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: true,
			},
		];

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result).toMatchObject({ taskId: 1, title: "Active task" });
	});

	it("post-check-in next prefers lower sortOrder when scores tie", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FOCUSED" }];
		tasks = [
			{
				id: 1,
				title: "Later manual priority",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "Top manual priority",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 0,
				createdAt: new Date("2026-01-02"),
				...taskDefaults(2),
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result).toMatchObject({
			taskId: 2,
			title: "Top manual priority",
		});
	});

	it("kickoff override feeds lastOverrideWorkType on subsequent next", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		tasks = [
			{
				id: 1,
				title: "Ops queue",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-01"),
				weight: 1,
				importance: 2,
				urgency: 1,
				effortMinutes: null,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "Inbox",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 0,
				createdAt: new Date("2026-01-02"),
				...taskDefaults(2),
			},
		];

		await caller().recordDecision({
			context: "kickoff",
			sessionId: 1,
			suggestedTaskId: 1,
			chosenTaskId: 2,
		});

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result).toMatchObject({
			taskId: 2,
			workType: "REACTIVE",
			rationaleKey: "override_preference",
		});
		expectBreakdownShape(result);
	});

	it("post-check-in next surfaces Interruptions in breakdown when interruption count is high", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 4, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FADING" }];
		tasks = [
			{
				id: 1,
				title: "Inbox",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(3),
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expectBreakdownShape(result);
		expect(result?.rationaleKey).toBe("energy_light");
		const dominantKeys =
			result?.breakdown.dominant.map((item) => item.key) ?? [];
		const chips = result?.breakdown.alsoConsidered ?? [];
		const hasInterruptions =
			dominantKeys.includes("interruptions") || chips.includes("Interruptions");
		expect(hasInterruptions).toBe(true);
	});

	it("kickoff prepends persona trust clause on first suggestion for preset task", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		tasks = [
			{
				id: 1,
				title: "Sync inbox",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				personaPresetId: "synchro",
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: 15,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: false,
			},
		];

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result?.rationale).toMatch(
			/^Synchro — operational work fits your choice\./,
		);
		expectBreakdownShape(result);
	});

	it("kickoff omits persona clause after task was previously suggested", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		const taskRow: TaskRow = {
			id: 1,
			title: "Sync inbox",
			status: "active",
			userId: USER_ID,
			workType: "OPERATIONAL",
			sortOrder: 0,
			createdAt: new Date("2026-01-01"),
			personaPresetId: "synchro",
			weight: 2,
			importance: 2,
			urgency: 2,
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
			isDailyStanding: false,
		};
		tasks = [taskRow];
		decisions = [
			{
				id: 1,
				cycleId: null,
				sessionId: 1,
				context: "KICKOFF",
				userId: USER_ID,
				suggestedTaskId: 1,
				chosenTaskId: 1,
				accepted: true,
				createdAt: new Date("2026-01-02"),
				chosenTask: taskRow,
			},
		];

		const result = await caller().next({
			context: "kickoff",
			sessionId: 1,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
			energy: "STEADY",
		});

		expect(result?.rationale).not.toMatch(/^Synchro —/);
		expectBreakdownShape(result);
	});

	it("post-check-in skips persona clause for custom preset tasks", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FOCUSED" }];
		tasks = [
			{
				id: 1,
				title: "Deep feature",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				personaPresetId: "custom",
				...taskDefaults(3),
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result?.rationale).not.toMatch(/^Custom —/);
		expect(result?.rationaleKey).toBe("energy_deep");
	});

	it("post-check-in prefers capacity-fit task when budget is tight", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "FADING" }];
		dayPlans = [
			{
				userId: USER_ID,
				localDateKey: LOCAL_DATE_KEY,
				focusBudgetMinutes: 120,
				usedFocusMinutes: 90,
			},
		];
		tasks = [
			{
				id: 1,
				title: "Long refactor",
				status: "active",
				userId: USER_ID,
				workType: "DEEP_WORK",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: 120,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: false,
			},
			{
				id: 2,
				title: "Daily stand-up prep",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-02"),
				weight: 2,
				importance: 2,
				urgency: 2,
				effortMinutes: 20,
				commitmentHorizon: "WHEN_POSSIBLE",
				isDailyStanding: true,
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result).toMatchObject({
			taskId: 2,
		});
		expect(
			result?.rationaleKey === "capacity_fit" ||
				result?.rationale.includes("min left today") ||
				result?.breakdown.dominant.some((item) => item.key === "capacity_fit"),
		).toBe(true);
		expectBreakdownShape(result);
	});

	it("post-check-in excludes standing task marked done for today", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		taskDayCompletions = [
			{
				userId: USER_ID,
				taskId: 2,
				localDateKey: LOCAL_DATE_KEY,
			},
		];
		tasks = [
			{
				id: 1,
				title: "Inbox",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "Daily stand-up prep",
				status: "active",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-02"),
				effortMinutes: 15,
				isDailyStanding: true,
				weight: 2,
				importance: 2,
				urgency: 2,
				commitmentHorizon: "WHEN_POSSIBLE",
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result).toMatchObject({
			taskId: 1,
			title: "Inbox",
		});
	});

	it("post-check-in excludes archived tasks including archived daily-standing rows", async () => {
		sessions = [
			{ id: 1, userId: USER_ID, interruptionCount: 0, state: "ACTIVE" },
		];
		cycles = [
			{
				id: 10,
				sessionId: 1,
				userId: USER_ID,
				kind: "WORK",
				state: "COMPLETED",
			},
		];
		checkIns = [{ cycleId: 10, userId: USER_ID, energy: "STEADY" }];
		tasks = [
			{
				id: 1,
				title: "Active inbox",
				status: "active",
				userId: USER_ID,
				workType: "REACTIVE",
				sortOrder: 0,
				createdAt: new Date("2026-01-01"),
				...taskDefaults(2),
			},
			{
				id: 2,
				title: "Archived standing",
				status: "archived",
				userId: USER_ID,
				workType: "OPERATIONAL",
				sortOrder: 1,
				createdAt: new Date("2026-01-02"),
				effortMinutes: 15,
				isDailyStanding: true,
				weight: 2,
				importance: 2,
				urgency: 2,
				commitmentHorizon: "WHEN_POSSIBLE",
			},
		];

		const result = await caller().next({
			context: "post_check_in",
			cycleId: 10,
			localHour: 10,
			localDateKey: LOCAL_DATE_KEY,
		});

		expect(result).toMatchObject({
			taskId: 1,
			title: "Active inbox",
		});
	});
});
