import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/server/db/index", () => ({
	db: {},
}));

const mockGetSession = vi.fn();
vi.mock("~/lib/auth/server", () => ({
	auth: {
		getSession: () => mockGetSession(),
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const {
	createCallerFactory,
	createTRPCContext,
	createTRPCRouter,
	protectedProcedure,
} = await import("~/server/api/trpc");

const testRouter = createTRPCRouter({
	getUser: protectedProcedure.query(({ ctx }) => ctx.session.user),
});

const createCaller = createCallerFactory(testRouter);

const VALID_USER = {
	id: "user-1",
	email: "test@example.com",
	name: "Test User",
};

type TestContext = Awaited<ReturnType<typeof createTRPCContext>>;

function protectedCaller(session: TestContext["session"]) {
	return createCaller({
		db: {} as TestContext["db"],
		session,
		headers: new Headers(),
	});
}

describe("protectedProcedure middleware", () => {
	it("throws UNAUTHORIZED when ctx.session is null", async () => {
		await expect(protectedCaller(null).getUser()).rejects.toBeInstanceOf(
			TRPCError,
		);
		await expect(protectedCaller(null).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when session has no user", async () => {
		await expect(
			protectedCaller({ user: undefined as never }).getUser(),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when session object omits user", async () => {
		await expect(
			protectedCaller({} as TestContext["session"]).getUser(),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when user id is missing", async () => {
		await expect(
			protectedCaller({
				user: { id: "", email: VALID_USER.email, name: VALID_USER.name },
			}).getUser(),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when user email is missing", async () => {
		await expect(
			protectedCaller({
				user: { id: VALID_USER.id, email: "", name: VALID_USER.name },
			}).getUser(),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("throws UNAUTHORIZED when user name is missing", async () => {
		await expect(
			protectedCaller({
				user: { id: VALID_USER.id, email: VALID_USER.email, name: "" },
			}).getUser(),
		).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("reaches the resolver when session has complete user identity", async () => {
		const user = await protectedCaller({ user: VALID_USER }).getUser();

		expect(user).toEqual(VALID_USER);
	});
});

describe("createTRPCContext session hydration", () => {
	beforeEach(() => {
		mockGetSession.mockReset();
	});

	it("leaves session null when auth response has no user", async () => {
		mockGetSession.mockResolvedValue({ data: {} });

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toBeNull();
		await expect(createCaller(ctx).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("leaves session null when getSession data is undefined", async () => {
		mockGetSession.mockResolvedValue({ data: undefined });

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toBeNull();
		await expect(createCaller(ctx).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("leaves session null when user email is missing", async () => {
		mockGetSession.mockResolvedValue({
			data: { user: { id: "user-1", email: null, name: "Test" } },
		});

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toBeNull();
		await expect(createCaller(ctx).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("leaves session null when user id is missing", async () => {
		mockGetSession.mockResolvedValue({
			data: { user: { id: "", email: "test@example.com", name: "Test" } },
		});

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toBeNull();
		await expect(createCaller(ctx).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("hydrates session with email-derived name when name is absent", async () => {
		mockGetSession.mockResolvedValue({
			data: {
				user: {
					id: "user-1",
					email: "alice@example.com",
					name: null,
				},
			},
		});

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toEqual({
			user: {
				id: "user-1",
				email: "alice@example.com",
				name: "alice",
			},
		});

		const user = await createCaller(ctx).getUser();
		expect(user).toEqual({
			id: "user-1",
			email: "alice@example.com",
			name: "alice",
		});
	});

	it("maps getSession errors to null session and rejects protected calls", async () => {
		mockGetSession.mockRejectedValue(new Error("auth unavailable"));

		const ctx = await createTRPCContext({ headers: new Headers() });

		expect(ctx.session).toBeNull();
		await expect(createCaller(ctx).getUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});
});
