import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrendPoint } from "~/lib/recap/aggregate-trend-stats";

let dataMode: "authenticated" | "guest" = "authenticated";
let queryInput: { todayLocalMidnightUtc: Date; windowDays: 7 | 30 } | undefined;

const emptyTrend: TrendPoint[] = [];

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
}));

const guestSnapshot = { tasks: [], sessions: [], cycles: [] as unknown[] };

vi.mock("~/lib/guest/store", () => ({
	loadSnapshot: vi.fn(() => guestSnapshot),
	subscribeGuestStore: vi.fn(() => () => {}),
}));

const buildGuestTrendStats = vi.fn(
	(_snapshot: unknown, _windowDays: 7 | 30) => emptyTrend,
);

vi.mock("~/lib/guest/day-stats", () => ({
	buildGuestTrendStats: (snapshot: unknown, windowDays: 7 | 30) =>
		buildGuestTrendStats(snapshot, windowDays),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		recap: {
			getTrendStats: {
				useQuery: (
					input: { todayLocalMidnightUtc: Date; windowDays: 7 | 30 },
					opts?: { enabled?: boolean },
				) => {
					if (opts?.enabled !== false) {
						queryInput = input;
						return { data: emptyTrend, isLoading: false };
					}
					return { data: undefined, isLoading: false };
				},
			},
		},
	},
}));

const { useTrendStats } = await import("~/hooks/use-trend-stats");
const { GUEST_STORAGE_KEY } = await import("~/lib/guest/schema");

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

describe("useTrendStats", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));
		dataMode = "authenticated";
		queryInput = undefined;
		localStorage.removeItem(GUEST_STORAGE_KEY);
		buildGuestTrendStats.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("queries today's local midnight instant for the given window", () => {
		const { result } = renderHook(() => useTrendStats(7), {
			wrapper: createWrapper(),
		});

		expect(result.current.trend).toEqual(emptyTrend);
		expect(queryInput?.windowDays).toBe(7);
		expect(queryInput?.todayLocalMidnightUtc).toEqual(new Date(2026, 5, 20));
	});

	it("re-queries with a 30-day window when the caller passes windowDays=30", () => {
		const { rerender } = renderHook(
			({ windowDays }: { windowDays: 7 | 30 }) => useTrendStats(windowDays),
			{ wrapper: createWrapper(), initialProps: { windowDays: 7 } },
		);
		expect(queryInput?.windowDays).toBe(7);

		rerender({ windowDays: 30 });
		expect(queryInput?.windowDays).toBe(30);
	});

	it("builds guest trend stats for the given window when not authenticated", () => {
		dataMode = "guest";
		localStorage.setItem(GUEST_STORAGE_KEY, '{"marker":"trend-guest-test"}');
		const { result, rerender } = renderHook(
			({ windowDays }: { windowDays: 7 | 30 }) => useTrendStats(windowDays),
			{ wrapper: createWrapper(), initialProps: { windowDays: 7 } },
		);

		expect(result.current.isGuest).toBe(true);
		expect(buildGuestTrendStats).toHaveBeenCalledWith(guestSnapshot, 7);

		rerender({ windowDays: 30 });

		expect(buildGuestTrendStats).toHaveBeenCalledWith(guestSnapshot, 30);
	});
});
