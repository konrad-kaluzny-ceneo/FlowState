import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type DayPlanData = {
	localDateKey: string;
	focusBudgetMinutes: number | null;
	usedFocusMinutes: number;
	remainingFocusMinutes: number | null;
};

let dataMode: "authenticated" | "guest" = "authenticated";
let dayPlanData: DayPlanData = {
	localDateKey: "2026-06-19",
	focusBudgetMinutes: 120,
	usedFocusMinutes: 30,
	remainingFocusMinutes: 90,
};
let queryInput: { localDateKey: string } | undefined;
const invalidateDayPlan = vi.fn();
const invalidateTaskList = vi.fn();
const setBudgetMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => dataMode,
}));

vi.mock("~/lib/time/local-date-key", () => ({
	formatLocalDateKey: vi.fn(() => "2026-06-19"),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			dayPlan: {
				getOrCreate: {
					invalidate: invalidateDayPlan,
				},
			},
			task: {
				list: {
					invalidate: invalidateTaskList,
				},
			},
		}),
		dayPlan: {
			getOrCreate: {
				useQuery: (
					input: { localDateKey: string },
					opts?: { enabled?: boolean },
				) => {
					queryInput = input;
					if (opts?.enabled === false) {
						return { data: undefined, isLoading: false };
					}
					return {
						data: { ...dayPlanData, localDateKey: input.localDateKey },
						isLoading: false,
					};
				},
			},
			setBudget: {
				useMutation: () => ({
					mutateAsync: setBudgetMutateAsync,
					isPending: false,
				}),
			},
		},
	},
}));

const { useDayPlan } = await import("~/hooks/use-day-plan");
const { formatLocalDateKey } = await import("~/lib/time/local-date-key");

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

describe("useDayPlan", () => {
	beforeEach(() => {
		dataMode = "authenticated";
		dayPlanData = {
			localDateKey: "2026-06-19",
			focusBudgetMinutes: 120,
			usedFocusMinutes: 30,
			remainingFocusMinutes: 90,
		};
		queryInput = undefined;
		vi.mocked(formatLocalDateKey).mockReturnValue("2026-06-19");
		vi.clearAllMocks();
	});

	it("returns remaining minutes from the day plan query", () => {
		const { result } = renderHook(() => useDayPlan(), {
			wrapper: createWrapper(),
		});

		expect(queryInput).toEqual({ localDateKey: "2026-06-19" });
		expect(result.current.remainingMinutes).toBe(90);
		expect(result.current.budgetMinutes).toBe(120);
		expect(result.current.hasBudget).toBe(true);
	});

	it("rolls over to a new local date on visibility change", async () => {
		const { result } = renderHook(() => useDayPlan(), {
			wrapper: createWrapper(),
		});

		expect(result.current.localDateKey).toBe("2026-06-19");

		vi.mocked(formatLocalDateKey).mockReturnValue("2026-06-20");

		await act(async () => {
			document.dispatchEvent(new Event("visibilitychange"));
		});

		await waitFor(() => {
			expect(result.current.localDateKey).toBe("2026-06-20");
		});
		expect(invalidateDayPlan).toHaveBeenCalledWith({
			localDateKey: "2026-06-20",
		});
		expect(invalidateTaskList).toHaveBeenCalledWith({
			localDateKey: "2026-06-20",
		});
	});

	it("does not query day plan in guest mode", () => {
		dataMode = "guest";
		const { result } = renderHook(() => useDayPlan(), {
			wrapper: createWrapper(),
		});

		expect(result.current.isLoading).toBe(false);
		expect(result.current.remainingMinutes).toBeNull();
	});
});
