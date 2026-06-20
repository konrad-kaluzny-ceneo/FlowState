import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
	auth: { getSession: vi.fn() },
}));

vi.mock("~/lib/recap/build-daily-recap", () => ({
	buildDailyRecap: vi.fn(),
}));

import { buildDailyRecap } from "~/lib/recap/build-daily-recap";
import { installImmediateSetTimeout } from "~/test-utils/immediate-set-timeout";

installImmediateSetTimeout();

const { createCallerFactory } = await import("~/server/api/trpc");
const { recapRouter } = await import("~/server/api/routers/recap");
const { db } = await import("~/server/db/index");

const createCaller = createCallerFactory(recapRouter);

const USER = "recap-router-user";
const DATE_KEY = "2026-06-20";

function recapCaller(userId: string) {
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

describe("recap router", () => {
	beforeEach(() => {
		vi.mocked(buildDailyRecap).mockReset();
	});

	it("getDaily delegates to buildDailyRecap with session user", async () => {
		const payload = {
			last24Hours: [],
			todayPlan: [],
			footprints: {},
		};
		vi.mocked(buildDailyRecap).mockResolvedValue(payload);

		const result = await recapCaller(USER).getDaily({ localDateKey: DATE_KEY });

		expect(vi.mocked(buildDailyRecap)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(buildDailyRecap).mock.calls[0]?.[1]).toBe(USER);
		expect(vi.mocked(buildDailyRecap).mock.calls[0]?.[2]).toBe(DATE_KEY);
		expect(result).toEqual(payload);
	});

	it("getDaily rejects invalid localDateKey", async () => {
		await expect(
			recapCaller(USER).getDaily({ localDateKey: "06-20-2026" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
