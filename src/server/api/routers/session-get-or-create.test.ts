import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

let sessions: Array<{
	id: number;
	userId: string;
	state: string;
	archivedAt: Date | null;
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
							if (
								args.where.archivedAt === null &&
								s.archivedAt !== null
							) {
								return false;
							}
							return true;
						}) ?? null,
					);
				},
			),
			create: vi.fn((args: { data: { userId: string } }) => {
				const session = {
					id: nextId++,
					userId: args.data.userId,
					state: "ACTIVE",
					archivedAt: null,
				};
				sessions.push(session);
				return Promise.resolve(session);
			}),
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

describe("session.getOrCreateActive", () => {
	beforeEach(() => {
		sessions = [];
		nextId = 1;
		vi.clearAllMocks();
	});

	it("creates a session when none exists", async () => {
		const session = await createCaller({
			db: db as never,
			session: {
				user: { id: USER_ID, email: "t@example.com", name: "Test" },
			},
			headers: new Headers(),
		}).getOrCreateActive();

		expect(session.userId).toBe(USER_ID);
		expect(session.state).toBe("ACTIVE");
		expect(sessions).toHaveLength(1);
	});

	it("returns existing active session on second call", async () => {
		const caller = createCaller({
			db: db as never,
			session: {
				user: { id: USER_ID, email: "t@example.com", name: "Test" },
			},
			headers: new Headers(),
		});

		const first = await caller.getOrCreateActive();
		const second = await caller.getOrCreateActive();

		expect(second.id).toBe(first.id);
		expect(sessions).toHaveLength(1);
	});
});
