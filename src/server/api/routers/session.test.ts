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
						state?: string;
						archivedAt?: null;
					};
				}) => {
					return Promise.resolve(
						sessions.find((s) => {
							if (args.where.userId != null && s.userId !== args.where.userId)
								return false;
							if (args.where.state != null && s.state !== args.where.state)
								return false;
							if (args.where.archivedAt === null && s.archivedAt !== null) {
								return false;
							}
							return true;
						}) ?? null,
					);
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
	},
}));

const originalSetTimeout = globalThis.setTimeout;
// biome-ignore lint/suspicious/noExplicitAny: test utility override
globalThis.setTimeout = ((fn: () => void) => originalSetTimeout(fn, 0)) as any;

const { createCallerFactory } = await import("~/server/api/trpc");
const { sessionRouter } = await import("~/server/api/routers/session");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(sessionRouter);
const USER_ID = "user-session-test";

function sessionCaller() {
	return createCaller({
		db: db as never,
		session: {
			user: { id: USER_ID, email: "t@example.com", name: "Test" },
		},
		headers: new Headers(),
	});
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
				},
			];

			const session = await sessionCaller().getOrCreateActive();

			expect(session.id).not.toBe(50);
			expect(sessions[0]?.state).toBe("ENDED_BY_TIMEOUT");
			expect(sessions[0]?.endedAt).not.toBeNull();
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
				},
			];

			const session = await sessionCaller().getOrCreateActive();

			expect(session.id).toBe(60);
			expect(sessions).toHaveLength(1);
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
				},
			];

			const result = await sessionCaller().end();

			expect(result.state).toBe("ENDED_BY_USER");
			expect(result.endedAt).not.toBeNull();
		});

		it("throws NOT_FOUND when no active session exists", async () => {
			await expect(sessionCaller().end()).rejects.toMatchObject({
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
				},
			];

			await expect(sessionCaller().end()).rejects.toMatchObject({
				code: "NOT_FOUND",
			});
		});
	});
});
