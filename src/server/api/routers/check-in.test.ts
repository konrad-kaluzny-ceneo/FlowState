import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LIST_LIMIT } from "~/server/api/config";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type EnergyLevel = "FOCUSED" | "STEADY" | "FADING";

type CheckInRow = {
	id: number;
	cycleId: number;
	userId: string;
	energy: EnergyLevel;
	respondedAt: Date;
};

let allCycles: Array<{ id: number; userId: string }> = [];
let allCheckIns: CheckInRow[] = [];
let checkInCycleIds = new Set<number>();
let nextCheckInId = 1;
let nextRespondedAtMs = 0;

vi.mock("~/server/db/index", () => ({
	db: {
		checkIn: {
			findMany: vi.fn(
				(args: {
					where?: { userId?: string };
					orderBy?: { respondedAt?: "asc" | "desc" };
					take?: number;
				}) => {
					const userId = args?.where?.userId;
					let rows = userId
						? allCheckIns.filter((c) => c.userId === userId)
						: [...allCheckIns];
					if (args?.orderBy?.respondedAt === "desc") {
						rows = [...rows].sort(
							(a, b) => b.respondedAt.getTime() - a.respondedAt.getTime(),
						);
					}
					if (args?.take != null) {
						rows = rows.slice(0, args.take);
					}
					return Promise.resolve(rows);
				},
			),
			create: vi.fn(
				(args: {
					data: { cycleId: number; userId: string; energy: EnergyLevel };
				}) => {
					if (checkInCycleIds.has(args.data.cycleId)) {
						const error = new Error("Unique constraint failed") as Error & {
							code: string;
						};
						error.code = "P2002";
						return Promise.reject(error);
					}
					nextRespondedAtMs += 1000;
					const row: CheckInRow = {
						id: nextCheckInId++,
						cycleId: args.data.cycleId,
						userId: args.data.userId,
						energy: args.data.energy,
						respondedAt: new Date(nextRespondedAtMs),
					};
					allCheckIns.push(row);
					checkInCycleIds.add(args.data.cycleId);
					return Promise.resolve(row);
				},
			),
		},
		cycle: {
			findFirst: vi.fn((args: { where?: { id?: number; userId?: string } }) => {
				return Promise.resolve(
					allCycles.find(
						(c) => c.id === args?.where?.id && c.userId === args?.where?.userId,
					) ?? null,
				);
			}),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { checkInRouter } = await import("~/server/api/routers/check-in");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(checkInRouter);
const USER_ID = "check-in-persistence-user";

function checkInCaller(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: {
				id: userId,
				email: "test@example.com",
				name: "Test User",
			},
		},
		headers: new Headers(),
	});
}

function seedOwnedCycle(cycleId: number, userId: string = USER_ID) {
	allCycles.push({ id: cycleId, userId });
}

describe("checkIn router persistence", () => {
	beforeEach(() => {
		allCycles = [];
		allCheckIns = [];
		checkInCycleIds = new Set();
		nextCheckInId = 1;
		nextRespondedAtMs = Date.now();
		vi.clearAllMocks();
	});

	it("create returns cycleId, userId, energy, and respondedAt", async () => {
		seedOwnedCycle(1);
		const caller = checkInCaller();

		const created = await caller.create({ cycleId: 1, energy: "FOCUSED" });

		expect(created).toMatchObject({
			cycleId: 1,
			userId: USER_ID,
			energy: "FOCUSED",
		});
		expect(created.respondedAt).toBeInstanceOf(Date);
	});

	it("create persists energy readable via list", async () => {
		seedOwnedCycle(10);
		const caller = checkInCaller();

		await caller.create({ cycleId: 10, energy: "STEADY" });
		const list = await caller.list();

		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({
			cycleId: 10,
			userId: USER_ID,
			energy: "STEADY",
		});
	});

	it.each([
		"FOCUSED",
		"STEADY",
		"FADING",
	] as const)("round-trips energy %s through create and list", async (energy) => {
		const cycleId = energy === "FOCUSED" ? 1 : energy === "STEADY" ? 2 : 3;
		seedOwnedCycle(cycleId);
		const caller = checkInCaller();

		await caller.create({ cycleId, energy });
		const list = await caller.list();

		expect(list).toContainEqual(
			expect.objectContaining({ cycleId, energy, userId: USER_ID }),
		);
	});

	it("list returns newest check-in first when multiple exist", async () => {
		seedOwnedCycle(1);
		seedOwnedCycle(2);
		const caller = checkInCaller();

		await caller.create({ cycleId: 1, energy: "FOCUSED" });
		await caller.create({ cycleId: 2, energy: "FADING" });

		const list = await caller.list();

		expect(list).toHaveLength(2);
		expect(list[0]?.cycleId).toBe(2);
		expect(list[1]?.cycleId).toBe(1);
		expect(list[0]?.respondedAt.getTime()).toBeGreaterThan(
			list[1]?.respondedAt.getTime() ?? 0,
		);
	});

	it(`list honors DEFAULT_LIST_LIMIT (${DEFAULT_LIST_LIMIT}) with newest-first ordering`, async () => {
		const caller = checkInCaller();
		const baseTime = Date.now();

		for (let cycleId = 1; cycleId <= DEFAULT_LIST_LIMIT + 1; cycleId++) {
			allCheckIns.push({
				id: cycleId,
				cycleId,
				userId: USER_ID,
				energy: "STEADY",
				respondedAt: new Date(baseTime + cycleId * 1000),
			});
			checkInCycleIds.add(cycleId);
		}

		const list = await caller.list();

		expect(list).toHaveLength(DEFAULT_LIST_LIMIT);
		expect(list[0]?.cycleId).toBe(DEFAULT_LIST_LIMIT + 1);
		expect(list.some((row) => row.cycleId === 1)).toBe(false);
	});

	it("duplicate create throws CONFLICT and skips second insert", async () => {
		seedOwnedCycle(1);
		const caller = checkInCaller();

		await caller.create({ cycleId: 1, energy: "FOCUSED" });

		await expect(
			caller.create({ cycleId: 1, energy: "STEADY" }),
		).rejects.toMatchObject({ code: "CONFLICT" });

		expect(allCheckIns).toHaveLength(1);
		expect(allCheckIns[0]?.energy).toBe("FOCUSED");
	});
});
