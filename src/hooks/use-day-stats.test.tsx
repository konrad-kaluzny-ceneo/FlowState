import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DayStats } from "~/lib/recap/aggregate-day-stats";

let dataMode: "authenticated" | "guest" = "authenticated";
let queryInput: { rangeStart: Date; rangeEnd: Date } | undefined;

const emptyStats: DayStats = {
	tasksWithFocusCount: 0,
	doneTasksCount: 0,
	focusMinutes: 0,
	breakMinutes: 0,
	sessionCount: 0,
	avgSessionMinutes: 0,
	hourBuckets: [],
	workTypeStats: [],
	taskCompletionStat: { done: 0, partial: 0, undone: 0 },
};

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
}));

const guestSnapshot = { tasks: [], sessions: [], cycles: [] as unknown[] };

vi.mock("~/lib/guest/store", () => ({
	loadSnapshot: vi.fn(() => guestSnapshot),
	subscribeGuestStore: vi.fn(() => () => {}),
}));

const buildGuestDayStats = vi.fn(
	(_snapshot: unknown, _range: { start: Date; end: Date }) => emptyStats,
);

vi.mock("~/lib/guest/day-stats", () => ({
	buildGuestDayStats: (snapshot: unknown, range: { start: Date; end: Date }) =>
		buildGuestDayStats(snapshot, range),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		recap: {
			getDayStats: {
				useQuery: (
					input: { rangeStart: Date; rangeEnd: Date },
					opts?: { enabled?: boolean },
				) => {
					if (opts?.enabled !== false) {
						queryInput = input;
						return { data: emptyStats, isLoading: false };
					}
					return { data: undefined, isLoading: false };
				},
			},
		},
	},
}));

const { useDayStats } = await import("~/hooks/use-day-stats");
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

describe("useDayStats", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 5, 20, 12, 0, 0));
		dataMode = "authenticated";
		queryInput = undefined;
		localStorage.removeItem(GUEST_STORAGE_KEY);
		buildGuestDayStats.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("queries today's day boundary by default and disables next-day navigation", () => {
		const { result } = renderHook(() => useDayStats(), {
			wrapper: createWrapper(),
		});

		expect(result.current.viewedLocalDateKey).toBe("2026-06-20");
		expect(queryInput?.rangeStart).toEqual(new Date(2026, 5, 20));
		expect(queryInput?.rangeEnd).toEqual(new Date(2026, 5, 21));
		expect(result.current.canGoNext).toBe(false);
	});

	it("navigates to the previous day and enables next-day navigation", () => {
		const { result } = renderHook(() => useDayStats(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.goToPreviousDay();
		});

		expect(result.current.viewedLocalDateKey).toBe("2026-06-19");
		expect(queryInput?.rangeStart).toEqual(new Date(2026, 5, 19));
		expect(queryInput?.rangeEnd).toEqual(new Date(2026, 5, 20));
		expect(result.current.canGoNext).toBe(true);
	});

	it("returns to today via goToToday", () => {
		const { result } = renderHook(() => useDayStats(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.goToPreviousDay();
		});
		expect(result.current.canGoNext).toBe(true);

		act(() => {
			result.current.goToToday();
		});

		expect(result.current.viewedLocalDateKey).toBe("2026-06-20");
		expect(result.current.canGoNext).toBe(false);
	});

	it("builds guest stats for the viewed day's range when not authenticated", () => {
		dataMode = "guest";
		// Distinct marker so the hook's internal snapshot cache (keyed on
		// storage content + viewed day) can't collide with a leftover key
		// from a previous test's cache state.
		localStorage.setItem(GUEST_STORAGE_KEY, '{"marker":"guest-nav-test"}');
		const { result } = renderHook(() => useDayStats(), {
			wrapper: createWrapper(),
		});

		expect(result.current.isGuest).toBe(true);
		expect(buildGuestDayStats).toHaveBeenCalledWith(
			guestSnapshot,
			expect.objectContaining({
				start: new Date(2026, 5, 20),
				end: new Date(2026, 5, 21),
			}),
		);

		act(() => {
			result.current.goToPreviousDay();
		});

		expect(buildGuestDayStats).toHaveBeenCalledWith(
			guestSnapshot,
			expect.objectContaining({
				start: new Date(2026, 5, 19),
				end: new Date(2026, 5, 20),
			}),
		);
	});
});
