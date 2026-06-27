import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	toPrismaCycleEndAudioMode,
	toPrismaUserLocale,
} from "~/lib/persistence/prisma/enum-mappers";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

type PreferenceRow = {
	userId: string;
	cycleEndAudioMode: ReturnType<typeof toPrismaCycleEndAudioMode>;
	language: ReturnType<typeof toPrismaUserLocale> | null;
	updatedAt: Date;
};

type PrismaAudioMode = PreferenceRow["cycleEndAudioMode"];

let preferences: PreferenceRow[] = [];

vi.mock("~/server/db/index", () => ({
	db: {
		userPreference: {
			findUnique: vi.fn((args: { where: { userId: string } }) => {
				const row = preferences.find((p) => p.userId === args.where.userId);
				return Promise.resolve(row ?? null);
			}),
			upsert: vi.fn(
				(args: {
					where: { userId: string };
					create: {
						userId: string;
						cycleEndAudioMode: PrismaAudioMode;
						language?: ReturnType<typeof toPrismaUserLocale> | null;
					};
					update: {
						cycleEndAudioMode?: PrismaAudioMode;
						language?: ReturnType<typeof toPrismaUserLocale> | null;
					};
				}) => {
					const existing = preferences.find(
						(p) => p.userId === args.where.userId,
					);
					if (existing) {
						if (args.update.cycleEndAudioMode !== undefined) {
							existing.cycleEndAudioMode = args.update.cycleEndAudioMode;
						}
						if (args.update.language !== undefined) {
							existing.language = args.update.language;
						}
						existing.updatedAt = new Date();
						return Promise.resolve(existing);
					}
					const row: PreferenceRow = {
						userId: args.create.userId,
						cycleEndAudioMode: args.create.cycleEndAudioMode,
						language: args.create.language ?? null,
						updatedAt: new Date(),
					};
					preferences.push(row);
					return Promise.resolve(row);
				},
			),
		},
	},
}));

import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { preferenceRouter } = await import("~/server/api/routers/preference");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(preferenceRouter);

const USER_A = "preference-user-a";
const USER_B = "preference-user-b";

function preferenceCaller(userId: string) {
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

describe("preference router", () => {
	beforeEach(() => {
		preferences = [];
	});

	it("get returns normal when no preference row exists", async () => {
		const caller = preferenceCaller(USER_A);

		const result = await caller.get();

		expect(result).toEqual({ cycleEndAudioMode: "normal", language: null });
	});

	it("set persists cycleEndAudioMode and get returns stored value", async () => {
		const caller = preferenceCaller(USER_A);

		await caller.set({ cycleEndAudioMode: "muted" });
		const result = await caller.get();

		expect(result).toEqual({ cycleEndAudioMode: "muted", language: null });
	});

	it("get returns only the caller's preference, not another user's row", async () => {
		preferences.push({
			userId: USER_B,
			cycleEndAudioMode: "SOFT",
			language: null,
			updatedAt: new Date(),
		});

		const caller = preferenceCaller(USER_A);
		const result = await caller.get();

		expect(result).toEqual({ cycleEndAudioMode: "normal", language: null });
	});

	it("set for one user does not overwrite another user's preference", async () => {
		const callerA = preferenceCaller(USER_A);
		const callerB = preferenceCaller(USER_B);

		await callerB.set({ cycleEndAudioMode: "soft" });
		await callerA.set({ cycleEndAudioMode: "muted" });

		expect(await callerA.get()).toEqual({
			cycleEndAudioMode: "muted",
			language: null,
		});
		expect(await callerB.get()).toEqual({
			cycleEndAudioMode: "soft",
			language: null,
		});
	});

	it("rejects invalid cycleEndAudioMode enum values", async () => {
		const caller = preferenceCaller(USER_A);

		await expect(
			caller.set({ cycleEndAudioMode: "loud" as "normal" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("set persists language and get returns stored value", async () => {
		const caller = preferenceCaller(USER_A);

		await caller.set({ language: "pl" });
		const result = await caller.get();

		expect(result).toEqual({ cycleEndAudioMode: "normal", language: "pl" });
	});

	it("rejects invalid language enum values", async () => {
		const caller = preferenceCaller(USER_A);

		await expect(caller.set({ language: "de" as "en" })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});
});
