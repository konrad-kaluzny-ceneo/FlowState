import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the db module
vi.mock("~/server/db", () => ({
	db: {
		$queryRaw: vi.fn(),
	},
}));

// Mock global fetch for auth check
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { db } from "~/server/db";
import { GET } from "./route";

const mockedDb = vi.mocked(db);

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubEnv("NEON_AUTH_BASE_URL", "https://test.neonauth.com");
});

describe("GET /api/health", () => {
	it("returns 200 with ok status when both checks pass", async () => {
		mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		mockFetch.mockResolvedValue({ ok: true });

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			status: "ok",
			checks: { database: "ok", auth: "ok" },
		});
	});

	it("returns 503 with degraded status when database fails", async () => {
		mockedDb.$queryRaw.mockRejectedValue(new Error("Connection refused"));
		mockFetch.mockResolvedValue({ ok: true });

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({
			status: "degraded",
			checks: { database: "fail", auth: "ok" },
		});
	});

	it("returns 503 with degraded status when auth fails", async () => {
		mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		mockFetch.mockResolvedValue({ ok: false, status: 500 });

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({
			status: "degraded",
			checks: { database: "ok", auth: "fail" },
		});
	});

	it("returns 503 when auth base URL is not set", async () => {
		mockedDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
		vi.stubEnv("NEON_AUTH_BASE_URL", "");

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({
			status: "degraded",
			checks: { database: "ok", auth: "fail" },
		});
	});

	it("returns 503 when both checks fail", async () => {
		mockedDb.$queryRaw.mockRejectedValue(new Error("Connection refused"));
		mockFetch.mockRejectedValue(new Error("Network error"));

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(503);
		expect(body).toEqual({
			status: "degraded",
			checks: { database: "fail", auth: "fail" },
		});
	});

	it("handles database timeout gracefully", async () => {
		mockedDb.$queryRaw.mockImplementation(
			() =>
				new Promise((resolve) => setTimeout(resolve, 10_000)) as ReturnType<
					typeof mockedDb.$queryRaw
				>,
		);
		mockFetch.mockResolvedValue({ ok: true });

		// Use fake timers to simulate the timeout
		vi.useFakeTimers();
		const responsePromise = GET();
		await vi.advanceTimersByTimeAsync(6_000);
		const response = await responsePromise;
		const body = await response.json();
		vi.useRealTimers();

		expect(response.status).toBe(503);
		expect(body.checks.database).toBe("fail");
	});
});
