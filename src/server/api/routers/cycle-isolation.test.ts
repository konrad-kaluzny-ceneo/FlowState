import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: session domain model, Property: Cycle query isolation
 * Validates: NFR data isolation — each user only sees their own cycles.
 * Plus: cross-user FK injection guard on create.
 */

// Store all entities in in-memory arrays
let allSessions: Array<{
	id: number;
	userId: string;
	state: string;
}> = [];

let allTasks: Array<{
	id: number;
	userId: string;
}> = [];

let allCycles: Array<{
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: string;
	state: string;
	configuredDurationSec: number;
	startedAt: Date;
	endedAt: Date | null;
}> = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockCycleFindMany = vi.fn(
		(args: {
			where?: { userId?: string; sessionId?: number };
			orderBy?: unknown;
		}) => {
			const userId = args?.where?.userId;
			const sessionId = args?.where?.sessionId;
			let result = allCycles;
			if (userId) result = result.filter((c) => c.userId === userId);
			if (sessionId != null)
				result = result.filter((c) => c.sessionId === sessionId);
			return Promise.resolve(result);
		},
	);

	const mockCycleCreate = vi.fn(
		(args: {
			data: {
				sessionId: number;
				userId: string;
				kind: string;
				configuredDurationSec: number;
				taskId: number | null;
			};
		}) => {
			const newCycle = {
				id: allCycles.length + 1,
				sessionId: args.data.sessionId,
				userId: args.data.userId,
				taskId: args.data.taskId,
				kind: args.data.kind,
				state: "RUNNING",
				configuredDurationSec: args.data.configuredDurationSec,
				startedAt: new Date(),
				endedAt: null,
			};
			allCycles.push(newCycle);
			return Promise.resolve(newCycle);
		},
	);

	const mockSessionFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string } }) => {
			return Promise.resolve(
				allSessions.find(
					(s) => s.id === args?.where?.id && s.userId === args?.where?.userId,
				) ?? null,
			);
		},
	);

	const mockTaskFindFirst = vi.fn(
		(args: { where?: { id?: number; userId?: string } }) => {
			return Promise.resolve(
				allTasks.find(
					(t) => t.id === args?.where?.id && t.userId === args?.where?.userId,
				) ?? null,
			);
		},
	);

	return {
		db: {
			cycle: {
				findMany: mockCycleFindMany,
				create: mockCycleCreate,
			},
			session: {
				findFirst: mockSessionFindFirst,
			},
			task: {
				findFirst: mockTaskFindFirst,
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
const { cycleRouter } = await import("~/server/api/routers/cycle");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(cycleRouter);

/** Arbitrary for non-empty user IDs */
const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: session domain model, Property: Cycle query isolation", () => {
	beforeEach(() => {
		allSessions = [];
		allTasks = [];
		allCycles = [];
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
		"each user only sees their own cycles when querying",
		async (userIds, querierSeed) => {
			const querierIdx = querierSeed % userIds.length;
			const querierId = userIds[querierIdx]!;

			// Generate cycles distributed across users
			const cycleCount = 5 + (querierSeed % 16);
			const generatedCycles = [];
			for (let i = 0; i < cycleCount; i++) {
				const userId = userIds[i % userIds.length]!;
				generatedCycles.push({
					id: i + 1,
					sessionId: (i % 3) + 1,
					userId,
					taskId: i % 2 === 0 ? i + 1 : null,
					kind:
						i % 3 === 0 ? "work" : i % 3 === 1 ? "short_break" : "long_break",
					state: "RUNNING",
					configuredDurationSec: 1500,
					startedAt: new Date(2024, 0, i + 1),
					endedAt: null,
				});
			}

			allCycles = generatedCycles;

			const expectedCycles = allCycles.filter((c) => c.userId === querierId);

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

			const result = await caller.list({});

			for (const cycle of result) {
				expect(cycle.userId).toBe(querierId);
			}
			expect(result).toHaveLength(expectedCycles.length);
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
		"cross-user FK injection: create with another user's session returns NOT_FOUND",
		async (userIds, seed) => {
			const attackerId = userIds[0]!;
			const victimId = userIds[1]!;

			// Create a session owned by the victim
			allSessions = [{ id: 1, userId: victimId, state: "ACTIVE" }];

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
				caller.create({
					sessionId: 1,
					kind: "WORK",
					configuredDurationSec: 1500 + (seed % 100),
				}),
			).rejects.toThrow(/NOT_FOUND/);
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
	)("a user with no cycles gets an empty result", async (userIds, seed) => {
		const querierId = userIds[0]!;
		const otherUserIds = userIds.slice(1);

		const cycleCount = 3 + (seed % 10);
		allCycles = [];
		for (let i = 0; i < cycleCount; i++) {
			const ownerId = otherUserIds[i % otherUserIds.length]!;
			allCycles.push({
				id: i + 1,
				sessionId: 1,
				userId: ownerId,
				taskId: null,
				kind: "work",
				state: "RUNNING",
				configuredDurationSec: 1500,
				startedAt: new Date(2024, 0, i + 1),
				endedAt: null,
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

		const result = await caller.list({});
		expect(result).toHaveLength(0);
	});
});
