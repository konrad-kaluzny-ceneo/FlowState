import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

let sessions: Array<{
	id: number;
	userId: string;
	state: string;
	archivedAt: Date | null;
	lastActivityAt: Date;
	endedAt: Date | null;
	closureLine: string | null;
	lastFocusedTaskId: number | null;
}> = [];
let nextId = 1;

vi.mock("~/server/db/index", () => ({
	db: {
		session: {
			findMany: vi.fn(() => Promise.resolve(sessions)),
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						state?: string | { in: string[] };
						archivedAt?: null;
						endedAt?: { not: null };
					};
					orderBy?: { endedAt: "desc" };
				}) => {
					const matches = sessions.filter((s) => {
						if (args.where.userId != null && s.userId !== args.where.userId)
							return false;
						if (typeof args.where.state === "string") {
							if (s.state !== args.where.state) return false;
						} else if (args.where.state?.in != null) {
							if (!args.where.state.in.includes(s.state)) return false;
						}
						if (args.where.archivedAt === null && s.archivedAt !== null) {
							return false;
						}
						if (args.where.endedAt?.not === null && s.endedAt == null) {
							return false;
						}
						return true;
					});

					if (args.orderBy?.endedAt === "desc") {
						matches.sort(
							(a, b) =>
								(b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0),
						);
					}

					return Promise.resolve(matches[0] ?? null);
				},
			),
			create: vi.fn((args: { data: { userId: string } }) => {
				const now = new Date();
				const session = {
					id: nextId++,
					userId: args.data.userId,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: now,
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				};
				sessions.push(session);
				return Promise.resolve(session);
			}),
			update: vi.fn(
				(args: { where: { id: number }; data: Record<string, unknown> }) => {
					const session = sessions.find((s) => s.id === args.where.id);
					if (!session) throw new Error("not found");
					Object.assign(session, args.data);
					return Promise.resolve(session);
				},
			),
			updateMany: vi.fn(
				(args: {
					where: {
						userId?: string;
						state?: string;
						archivedAt?: null;
					};
					data: Record<string, unknown>;
				}) => {
					let count = 0;
					for (const s of sessions) {
						if (args.where.userId != null && s.userId !== args.where.userId)
							continue;
						if (args.where.state != null && s.state !== args.where.state)
							continue;
						if (args.where.archivedAt === null && s.archivedAt !== null)
							continue;
						Object.assign(s, args.data);
						count++;
					}
					return Promise.resolve({ count });
				},
			),
		},
		cycle: {
			findFirst: vi.fn(() => Promise.resolve(null)),
			count: vi.fn(() => Promise.resolve(0)),
		},
		checkIn: {
			findFirst: vi.fn(() => Promise.resolve(null)),
		},
	},
}));

vi.mock("~/server/api/lib/session-end-metadata", () => ({
	computeSessionEndMetadata: vi.fn(
		async (
			_database: unknown,
			_userId: string,
			sessionId: number,
			endedBy: "timeout" | "user" | "pause_cap",
		) => ({
			closureLine:
				endedBy === "timeout"
					? "Session complete — 2 cycles. Take a breath."
					: "Session complete — 1 cycle. Take a breath.",
			lastFocusedTaskId: sessionId === 50 ? 12 : 7,
		}),
	),
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { sessionRouter } = await import("~/server/api/routers/session");
const { db } = await import("~/server/db/index");
const { computeSessionEndMetadata } = await import(
	"~/server/api/lib/session-end-metadata"
);

const createCaller = createCallerFactory(sessionRouter);
const USER_ID = "user-session-test";
const VICTIM_ID = "victim-session-user";
const ATTACKER_ID = "attacker-session-user";

function sessionCallerAs(userId: string = USER_ID) {
	return createCaller({
		db: db as never,
		session: {
			user: { id: userId, email: "t@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
}

function sessionCaller() {
	return sessionCallerAs(USER_ID);
}

describe("session router", () => {
	beforeEach(() => {
		sessions = [];
		nextId = 1;
		vi.clearAllMocks();
	});

	describe("getOrCreateActive", () => {
		it("creates a session when none exists", async () => {
			const session = await sessionCaller().getOrCreateActive();

			expect(session.userId).toBe(USER_ID);
			expect(session.state).toBe("ACTIVE");
			expect(sessions).toHaveLength(1);
		});

		it("returns existing active session on second call (idempotent)", async () => {
			const caller = sessionCaller();

			const first = await caller.getOrCreateActive();
			const second = await caller.getOrCreateActive();

			expect(second.id).toBe(first.id);
			expect(sessions).toHaveLength(1);
		});

		it("creates new session when only archived sessions exist", async () => {
			sessions = [
				{
					id: 99,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: new Date(),
					lastActivityAt: new Date(),
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const session = await sessionCaller().getOrCreateActive();

			expect(session.id).not.toBe(99);
			expect(sessions).toHaveLength(2);
		});

		it("ends stale session and creates new one when lastActivityAt > 4h", async () => {
			const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
			sessions = [
				{
					id: 50,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: fiveHoursAgo,
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const session = await sessionCaller().getOrCreateActive();

			expect(session.id).not.toBe(50);
			expect(sessions[0]?.state).toBe("ENDED_BY_TIMEOUT");
			expect(sessions[0]?.endedAt).not.toBeNull();
			expect(sessions[0]?.closureLine).toBe(
				"Session complete — 2 cycles. Take a breath.",
			);
			expect(sessions[0]?.lastFocusedTaskId).toBe(12);
			expect(computeSessionEndMetadata).toHaveBeenCalledWith(
				expect.anything(),
				USER_ID,
				50,
				"timeout",
			);
			expect(session.state).toBe("ACTIVE");
			expect(sessions).toHaveLength(2);
		});

		it("returns existing session when lastActivityAt < 4h", async () => {
			const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
			sessions = [
				{
					id: 60,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: oneHourAgo,
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const session = await sessionCaller().getOrCreateActive();

			expect(session.id).toBe(60);
			expect(sessions).toHaveLength(1);
		});

		it("does not reuse another user's active session", async () => {
			const victimSessionId = 42;
			sessions = [
				{
					id: victimSessionId,
					userId: VICTIM_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const attackerSession =
				await sessionCallerAs(ATTACKER_ID).getOrCreateActive();

			expect(attackerSession.userId).toBe(ATTACKER_ID);
			expect(attackerSession.id).not.toBe(victimSessionId);
			const victimRow = sessions.find((s) => s.id === victimSessionId);
			expect(victimRow).toMatchObject({
				id: victimSessionId,
				userId: VICTIM_ID,
				state: "ACTIVE",
			});
		});
	});

	describe("end", () => {
		it("ends the active session", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const result = await sessionCaller().end({});

			expect(result.state).toBe("ENDED_BY_USER");
			expect(result.endedAt).not.toBeNull();
		});

		it("throws NOT_FOUND when no active session exists", async () => {
			await expect(sessionCaller().end({})).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		});

		it("throws NOT_FOUND when session is already ended", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ENDED_BY_USER",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: new Date(),
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			await expect(sessionCaller().end({})).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		});
		it("persists closure line when provided", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const result = await sessionCaller().end({
				closureLine: "Session complete — 2 cycles.",
			});

			expect(result.closureLine).toBe("Session complete — 2 cycles.");
		});

		it("persists lastFocusedTaskId from client input", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ACTIVE",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: null,
					closureLine: null,
					lastFocusedTaskId: null,
				},
			];

			const result = await sessionCaller().end({
				closureLine: "Session complete — 1 cycle. Take a breath.",
				lastFocusedTaskId: 99,
			});

			expect(result.lastFocusedTaskId).toBe(99);
		});
	});

	describe("getLastEnded", () => {
		it("returns the most recently ended session", async () => {
			sessions = [
				{
					id: 1,
					userId: USER_ID,
					state: "ENDED_BY_USER",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: new Date("2020-01-01"),
					closureLine: "Older closure",
					lastFocusedTaskId: 3,
				},
				{
					id: 2,
					userId: USER_ID,
					state: "ENDED_BY_TIMEOUT",
					archivedAt: null,
					lastActivityAt: new Date(),
					endedAt: new Date("2025-06-01"),
					closureLine: "Latest closure",
					lastFocusedTaskId: 8,
				},
			];

			const result = await sessionCaller().getLastEnded();

			expect(result?.id).toBe(2);
			expect(result?.closureLine).toBe("Latest closure");
			expect(result?.lastFocusedTaskId).toBe(8);
		});
	});
});
