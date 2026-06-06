import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { beforeEach, describe, expect, vi } from "vitest";

/**
 * Feature: session domain model, Property: Session query isolation
 * Validates: NFR data isolation — each user only sees their own sessions.
 */

// Store all sessions in an in-memory array; the mock db will filter them
let allSessions: Array<{
	id: number;
	userId: string;
	state: string;
	startedAt: Date;
	endedAt: Date | null;
	lastActivityAt: Date;
	interruptionCount: number;
	archivedAt: Date | null;
}> = [];

// Mock ~/lib/auth/server
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: vi.fn(),
	},
}));

// Mock ~/server/db/index with Prisma-style API
vi.mock("~/server/db/index", () => {
	const mockFindMany = vi.fn(
		(args: {
			where?: { userId?: string; archivedAt?: null };
			orderBy?: unknown;
		}) => {
			const userId = args?.where?.userId;
			return Promise.resolve(
				userId
					? allSessions.filter(
							(s) => s.userId === userId && s.archivedAt === null,
						)
					: allSessions.filter((s) => s.archivedAt === null),
			);
		},
	);

	const mockCreate = vi.fn((args: { data: { userId: string } }) => {
		const newSession = {
			id: allSessions.length + 1,
			userId: args.data.userId,
			state: "ACTIVE",
			startedAt: new Date(),
			endedAt: null,
			lastActivityAt: new Date(),
			interruptionCount: 0,
			archivedAt: null,
		};
		allSessions.push(newSession);
		return Promise.resolve(newSession);
	});

	return {
		db: {
			session: {
				findMany: mockFindMany,
				create: mockCreate,
			},
		},
	};
});

import { atModOrThrow, atOrThrow } from "~/test-utils/array-access";
import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

// Import after mocks are set up
const { createCallerFactory } = await import("~/server/api/trpc");
const { sessionRouter } = await import("~/server/api/routers/session");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(sessionRouter);

/** Arbitrary for non-empty user IDs (alphanumeric to avoid edge cases with special chars) */
const userIdArb = fc
	.stringMatching(/^[a-zA-Z0-9]{1,50}$/)
	.filter((s) => s.length > 0);

describe("Feature: session domain model, Property: Session query isolation", () => {
	beforeEach(() => {
		allSessions = [];
		vi.clearAllMocks();
	});

	fcTest.prop(
		[
			// Generate 2-5 distinct user IDs
			fc
				.uniqueArray(userIdArb, { minLength: 2, maxLength: 5 })
				.filter((arr) => arr.length >= 2),
			// A seed to pick which user is the "querying" user
			fc.nat(),
		],
		{ numRuns: 100 },
	)(
		"each user only sees their own sessions when querying",
		async (userIds, querierSeed) => {
			// Pick the querying user
			const querierIdx = querierSeed % userIds.length;
			const querierId = atOrThrow(userIds, querierIdx);

			// Generate between 5 and 20 sessions distributed across all users
			const sessionCount = 5 + (querierSeed % 16);
			const generatedSessions = [];
			for (let i = 0; i < sessionCount; i++) {
				const userId = atModOrThrow(userIds, i);
				generatedSessions.push({
					id: i + 1,
					userId,
					state: i % 3 === 0 ? "ENDED_BY_USER" : "ACTIVE",
					startedAt: new Date(2024, 0, i + 1),
					endedAt: i % 3 === 0 ? new Date(2024, 0, i + 1, 1) : null,
					lastActivityAt: new Date(2024, 0, i + 1),
					interruptionCount: i % 4,
					archivedAt: null,
				});
			}

			allSessions = generatedSessions;

			// Expected: only sessions belonging to the querying user
			const expectedSessions = allSessions.filter(
				(s) => s.userId === querierId && s.archivedAt === null,
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

			// Property: result contains ONLY sessions belonging to the querying user
			for (const session of result) {
				expect(session.userId).toBe(querierId);
			}

			// Property: result contains ALL sessions belonging to the querying user
			expect(result).toHaveLength(expectedSessions.length);
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
	)("a user with no sessions gets an empty result", async (userIds, seed) => {
		// Assign all sessions to users OTHER than the querying user
		const querierId = atOrThrow(userIds, 0);
		const otherUserIds = userIds.slice(1);

		const sessionCount = 3 + (seed % 10);
		allSessions = [];
		for (let i = 0; i < sessionCount; i++) {
			const ownerId = atModOrThrow(otherUserIds, i);
			allSessions.push({
				id: i + 1,
				userId: ownerId,
				state: "ACTIVE",
				startedAt: new Date(2024, 0, i + 1),
				endedAt: null,
				lastActivityAt: new Date(2024, 0, i + 1),
				interruptionCount: 0,
				archivedAt: null,
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

		// Property: empty array when user owns no sessions
		expect(result).toHaveLength(0);
	});
});
