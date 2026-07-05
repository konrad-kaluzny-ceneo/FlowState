import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyRecap } from "~/lib/recap/types";
import { recapRow } from "~/test/recap-fixtures";

let dataMode: "authenticated" | "guest" = "authenticated";
const recapData: DailyRecap = {
	last24Hours: [
		recapRow({
			taskId: 1,
			title: "Auth task",
		}),
	],
	todayPlan: [],
	footprints: {},
};
let queryInput: { localDateKey: string } | undefined;
const invalidateRecap = vi.fn();
const invalidateTaskList = vi.fn();

const guestRecapBefore: DailyRecap = {
	last24Hours: [
		recapRow({
			taskId: "guest-task-id",
			title: "Guest task",
			firstStartedAt: new Date("2026-06-20T09:00:00Z"),
			lastEndedAt: new Date("2026-06-20T09:15:00Z"),
			focusedMinutes: 15,
		}),
	],
	todayPlan: [],
	footprints: {},
};

const guestRecapAfter: DailyRecap = {
	last24Hours: [
		recapRow({
			taskId: "guest-task-id",
			title: "Guest task",
			firstStartedAt: new Date("2026-06-20T09:00:00Z"),
			lastEndedAt: new Date("2026-06-20T09:30:00Z"),
			focusedMinutes: 30,
		}),
	],
	todayPlan: [],
	footprints: {},
};

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
}));

vi.mock("~/lib/time/local-date-key", () => ({
	formatLocalDateKey: vi.fn(() => "2026-06-20"),
}));

let guestStoreListener: (() => void) | null = null;
const guestSnapshot = { tasks: [], sessions: [], cycles: [] as unknown[] };

vi.mock("~/lib/guest/store", () => ({
	loadSnapshot: vi.fn(() => guestSnapshot),
	subscribeGuestStore: vi.fn((listener: () => void) => {
		guestStoreListener = listener;
		listener();
		return () => {
			guestStoreListener = null;
		};
	}),
}));

vi.mock("~/lib/guest/day-completions", () => ({
	getGuestDayCompletionsStorageKey: () => "flowstate:guest-day-completions-v1",
	getGuestDoneForTodayTaskIds: () => new Set<string>(),
	subscribeGuestDayCompletions: vi.fn(() => () => {}),
}));

vi.mock("~/lib/guest/recap", () => ({
	buildGuestDailyRecap: vi.fn(() => guestRecapBefore),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			recap: {
				getDaily: {
					invalidate: invalidateRecap,
				},
			},
			task: {
				list: {
					invalidate: invalidateTaskList,
				},
			},
		}),
		recap: {
			getDaily: {
				useQuery: (
					input: { localDateKey: string },
					opts?: { enabled?: boolean },
				) => {
					if (opts?.enabled !== false) {
						queryInput = input;
					}
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					return {
						data: recapData,
						isLoading: false,
					};
				},
			},
		},
	},
}));

const { buildGuestDailyRecap } = await import("~/lib/guest/recap");
const { useDailyRecap } = await import("~/hooks/use-daily-recap");
const { formatLocalDateKey } = await import("~/lib/time/local-date-key");
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

describe("useDailyRecap", () => {
	beforeEach(() => {
		dataMode = "authenticated";
		queryInput = undefined;
		guestSnapshot.cycles = [];
		guestStoreListener = null;
		localStorage.removeItem(GUEST_STORAGE_KEY);
		vi.mocked(formatLocalDateKey).mockReturnValue("2026-06-20");
		vi.mocked(buildGuestDailyRecap).mockReturnValue(guestRecapBefore);
		vi.clearAllMocks();
	});

	it("returns auth recap from tRPC query", () => {
		const { result } = renderHook(() => useDailyRecap(), {
			wrapper: createWrapper(),
		});

		expect(queryInput).toEqual({ localDateKey: "2026-06-20" });
		expect(result.current.recap.last24Hours[0]?.title).toBe("Auth task");
		expect(result.current.isLoading).toBe(false);
	});

	it("returns guest recap when not authenticated", () => {
		dataMode = "guest";
		const { result } = renderHook(() => useDailyRecap(), {
			wrapper: createWrapper(),
		});

		expect(result.current.recap.last24Hours[0]?.taskId).toBe("guest-task-id");
		expect(result.current.isLoading).toBe(false);
	});

	it("updates guest recap when snapshot store notifies", async () => {
		dataMode = "guest";
		const { result } = renderHook(() => useDailyRecap(), {
			wrapper: createWrapper(),
		});

		expect(result.current.recap.last24Hours[0]?.focusedMinutes).toBe(15);

		vi.mocked(buildGuestDailyRecap).mockReturnValue(guestRecapAfter);
		localStorage.setItem(GUEST_STORAGE_KEY, '{"cycles":[{"id":"c1"}]}');

		await act(async () => {
			guestStoreListener?.();
		});

		await waitFor(() => {
			expect(result.current.recap.last24Hours[0]?.focusedMinutes).toBe(30);
		});
	});

	it("invalidates recap on local date rollover", async () => {
		const { result } = renderHook(() => useDailyRecap(), {
			wrapper: createWrapper(),
		});

		expect(result.current.localDateKey).toBe("2026-06-20");

		vi.mocked(formatLocalDateKey).mockReturnValue("2026-06-21");

		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
		});

		await waitFor(() => {
			expect(result.current.localDateKey).toBe("2026-06-21");
		});
		expect(invalidateRecap).toHaveBeenCalledWith({
			localDateKey: "2026-06-21",
		});
	});
});
