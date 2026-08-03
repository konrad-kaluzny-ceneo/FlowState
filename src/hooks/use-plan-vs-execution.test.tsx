import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TrendPoint } from "~/lib/recap/aggregate-trend-stats";

let dataMode: "authenticated" | "guest" = "authenticated";
let trendStatsInput:
	| {
			todayLocalMidnightUtc: Date;
			todayLocalDateKey: string;
			windowDays: 7 | 30;
	  }
	| undefined;
let rangeQueryInput: { localDateKeys: string[] } | undefined;
let rangeQueryEnabled: boolean | undefined;

const trendPoints: TrendPoint[] = [
	{
		localDateKey: "2026-06-14",
		focusMinutes: 20,
		breakMinutes: 0,
		switchCount: 0,
	},
	{
		localDateKey: "2026-06-15",
		focusMinutes: 90,
		breakMinutes: 0,
		switchCount: 0,
	},
];

const mockGetTrendStats = vi.fn(
	async (input: {
		todayLocalMidnightUtc: Date;
		todayLocalDateKey: string;
		windowDays: 7 | 30;
	}) => {
		trendStatsInput = input;
		return trendPoints;
	},
);

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
	useRepositories: () => ({
		mode: dataMode,
		recap: {
			getTrendStats: mockGetTrendStats,
		},
	}),
}));

vi.mock("~/lib/guest/store", () => ({
	loadSnapshot: vi.fn(() => ({ tasks: [], sessions: [], cycles: [] })),
	subscribeGuestStore: vi.fn(() => () => {}),
}));

vi.mock("~/lib/guest/day-stats", () => ({
	buildGuestTrendStats: () => [],
}));

vi.mock("~/trpc/react", () => ({
	api: {
		recap: {
			getTrendStats: {
				useQuery: (
					input: {
						todayLocalMidnightUtc: Date;
						todayLocalDateKey: string;
						windowDays: 7 | 30;
					},
					opts?: { enabled?: boolean },
				) => {
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					trendStatsInput = input;
					return { data: trendPoints, isLoading: false };
				},
			},
		},
		dayPlan: {
			getRange: {
				useQuery: (
					input: { localDateKeys: string[] },
					opts?: { enabled?: boolean },
				) => {
					rangeQueryEnabled = opts?.enabled;
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					rangeQueryInput = input;
					return {
						data: [
							{ localDateKey: "2026-06-14", focusBudgetMinutes: null },
							{ localDateKey: "2026-06-15", focusBudgetMinutes: 60 },
						],
						isLoading: false,
					};
				},
			},
		},
	},
}));

const { usePlanVsExecution } = await import("~/hooks/use-plan-vs-execution");

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

describe("usePlanVsExecution", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
		dataMode = "authenticated";
		trendStatsInput = undefined;
		rangeQueryInput = undefined;
		rangeQueryEnabled = undefined;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("pairs trend actuals with planned budgets, null when no DayPlan row exists", async () => {
		const { result } = renderHook(() => usePlanVsExecution(7), {
			wrapper: createWrapper(),
		});

		await act(() => vi.advanceTimersByTimeAsync(0));

		expect(result.current.isAvailable).toBe(true);
		expect(result.current.trend).toEqual(trendPoints);
		expect(result.current.points).toEqual([
			{ localDateKey: "2026-06-14", plannedMinutes: null, actualMinutes: 20 },
			{ localDateKey: "2026-06-15", plannedMinutes: 60, actualMinutes: 90 },
		]);
		expect(trendStatsInput?.windowDays).toBe(7);
		expect(trendStatsInput?.todayLocalDateKey).toBe("2026-06-15");
		expect(rangeQueryInput?.localDateKeys).toEqual([
			"2026-06-14",
			"2026-06-15",
		]);
	});

	it("reflects the true actual even when it exceeds the planned budget", async () => {
		const { result } = renderHook(() => usePlanVsExecution(7), {
			wrapper: createWrapper(),
		});

		await act(() => vi.advanceTimersByTimeAsync(0));

		const overBudgetDay = result.current.points.find(
			(p) => p.localDateKey === "2026-06-15",
		);
		expect(overBudgetDay?.plannedMinutes).toBe(60);
		expect(overBudgetDay?.actualMinutes).toBe(90);
	});

	it("returns isAvailable: false and never fetches for guest mode", () => {
		dataMode = "guest";
		const { result } = renderHook(() => usePlanVsExecution(7), {
			wrapper: createWrapper(),
		});

		expect(result.current.isAvailable).toBe(false);
		expect(result.current.trend).toEqual([]);
		expect(result.current.points).toEqual([]);
		expect(rangeQueryEnabled).toBe(false);
	});
});
