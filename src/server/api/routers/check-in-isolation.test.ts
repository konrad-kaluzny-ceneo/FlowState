import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: session domain model, Property: CheckIn query isolation
 * Validates: NFR data isolation — each user only sees their own check-ins.
 * Plus: cross-user cycleId injection returns NOT_FOUND; double-create returns CONFLICT.
 */

// Store all entities in in-memory arrays
let allCycles: Array<{
	id: number;
	userId: string;
}> = [];

let allCheckIns: Array<{
	id: number;
	cycleId: number;
	userId: string;
	energy: string;
	respondedAt: Date;
}> = [];

// Track which cycleIds have check-ins for uniqueness enforcement
let checkInCycleIds: Set<number> = new Set();

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockCheckInFindMany = vi.fn(
		(args: { where?: { userId?: string }; orderBy?: unknown }) => {
			const userId = args?.where?.userId;
			return Promise.resolve(
				userId ? allCheckIns.filter((c) => c.userId === userId) : allCheckIns,
			);
		},
	);

	const mockCheckInCreate = vi.fn(
		(args: { data: { cycleId: number; userId: string; energy: string } }) => {
			// Enforce unique constraint on cycleId
			if (checkInCycleIds.has(args.data.cycleId)) {
				const error = new Error("Unique constraint failed") as Error & {
					code: string;
				};
				error.code = "P2002";
				return Promise.reject(error);
			}
			const newCheckIn = {
				id: allCheckIns.length + 1,
				cycleId: args.data.cycleId,
				userId: args.data.userId,
				energy: args.data.energy,
				respondedAt: new Date(),
			};
			allCheckIns.push(newCheckIn);
			checkInCycleIds.add(args.data.cycleId);
			return Promise.resolve(newCheckIn);
		},
	);

	const mockCycleFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string } }) => {
			return Promise.resolve(
				allCycles.find(
					(c) => c.id === args?.where?.id && c.userId === args?.where?.userId,
				) ?? null,
			);
		},
	);

	return {
		db: {
			checkIn: {
				findMany: mockCheckInFindMany,
				create: mockCheckInCreate,
			},
			cycle: {
				findFirst: mockCycleFindFirst,
			},
		},
	};
});

// Stub global setTimeout to resolve immediately (eliminates timingMiddleware dev delay)
const originalSetTimeout = globalThis.setTimeout;
// biome-ignore lint/suspicious/noExplicitAny: test utility override
globalThis.setTimeout = ((fn: () => void, _ms?: number) =>
	originalSetTimeout(fn, 0)) as any;

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { checkInRouter } = await import("~/server/api/routers/check-in");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(checkInRouter);

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: session domain model, Property: CheckIn query isolation", () => {
	beforeEach(() => {
		allCycles = [];
		allCheckIns = [];
		checkInCycleIds = new Set();
		vi.clearAllMocks();
	});

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 100 },
	)(
		"each user only sees their own check-ins when querying",
		async (userIds, querierSeed) => {
			const querierIdx = querierSeed % userIds.length;
			const querierId = userIds[querierIdx]!;

			// Generate check-ins distributed across users
			const checkInCount = 5 + (querierSeed % 16);
			const generatedCheckIns = [];
			for (let i = 0; i < checkInCount; i++) {
				const userId = userIds[i % userIds.length]!;
				generatedCheckIns.push({
					id: i + 1,
					cycleId: i + 1,
					userId,
					energy: i % 3 === 0 ? "FOCUSED" : i % 3 === 1 ? "STEADY" : "FADING",
					respondedAt: new Date(2024, 0, i + 1),
				});
			}

			allCheckIns = generatedCheckIns;

			const expectedCheckIns = allCheckIns.filter(
				(c) => c.userId === querierId,
			);

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: querierId,
						email: "test@example.com",
						name: "Test User",
					},
				},
				headers: new Headers(),
			});

			const result = await caller.list();

			for (const checkIn of result) {
				expect(checkIn.userId).toBe(querierId);
			}
			expect(result).toHaveLength(expectedCheckIns.length);
		},
	);

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 100 },
	)(
		"cross-user FK injection: create with another user's cycle returns NOT_FOUND",
		async (userIds, _seed) => {
			const attackerId = userIds[0]!;
			const victimId = userIds[1]!;

			// Create a cycle owned by the victim
			allCycles = [{ id: 1, userId: victimId }];

			const caller = createCaller({
				db: db as never,
				session: {
					user: {
						id: attackerId,
						email: "attacker@example.com",
						name: "Attacker",
					},
				},
				headers: new Headers(),
			});

			await expect(
				caller.create({ cycleId: 1, energy: "FOCUSED" }),
			).rejects.toThrow(/NOT_FOUND/);
		},
	);

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 1, maxLength: 3 })
				.filter((arr) => arr.length >= 1),
		],
		{ numRuns: 100 },
	)("double-create on the same cycle returns CONFLICT", async (userIds) => {
		const userId = userIds[0]!;

		// Create a cycle owned by the user
		allCycles = [{ id: 1, userId }];

		const caller = createCaller({
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

		// First create should succeed
		await caller.create({ cycleId: 1, energy: "FOCUSED" });

		// Second create on same cycle should throw CONFLICT
		await expect(
			caller.create({ cycleId: 1, energy: "STEADY" }),
		).rejects.toThrow(/check-in already exists/);
	});

	fcTest.prop(
		[
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			fc.nat(),
		],
		{ numRuns: 100 },
	)("a user with no check-ins gets an empty result", async (userIds, seed) => {
		const querierId = userIds[0]!;
		const otherUserIds = userIds.slice(1);

		const checkInCount = 3 + (seed % 10);
		allCheckIns = [];
		for (let i = 0; i < checkInCount; i++) {
			const ownerId = otherUserIds[i % otherUserIds.length]!;
			allCheckIns.push({
				id: i + 1,
				cycleId: i + 1,
				userId: ownerId,
				energy: "FOCUSED",
				respondedAt: new Date(2024, 0, i + 1),
			});
		}

		const caller = createCaller({
			db: db as never,
			session: {
				user: {
					id: querierId,
					email: "test@example.com",
					name: "Test User",
				},
			},
			headers: new Headers(),
		});

		const result = await caller.list();
		expect(result).toHaveLength(0);
	});
});
