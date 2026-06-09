import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";
import {
	beginSuggestionFetch,
	resetSuggestionFetchPriorityForTests,
} from "~/lib/trpc/suggestion-priority";

type MutationLifecycle<TInput = unknown> = {
	onSuccess?: (data: unknown, input: TInput) => void;
};

let preferenceData: { cycleEndAudioMode: CycleEndAudioMode } = {
	cycleEndAudioMode: "normal",
};
let queryEnabled = false;
let queryIsFetched = false;

const setPreferenceData = vi.fn(
	(_input: undefined, data: { cycleEndAudioMode: CycleEndAudioMode }) => {
		preferenceData = data;
	},
);

const setMutate = vi.fn();
const setMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			preference: {
				get: {
					setData: setPreferenceData,
				},
			},
		}),
		preference: {
			get: {
				useQuery: (_input: undefined, opts?: { enabled?: boolean }) => {
					queryEnabled = opts?.enabled ?? false;
					if (queryEnabled) {
						queryIsFetched = true;
					}
					return {
						data: queryEnabled ? preferenceData : undefined,
						isFetched: queryIsFetched,
					};
				},
			},
			set: {
				useMutation: (_opts: MutationLifecycle) => {
					return {
						mutate: setMutate,
						mutateAsync: setMutateAsync,
					};
				},
			},
		},
	},
}));

const { useCycleEndAudioPreference } = await import(
	"~/hooks/use-cycle-end-audio-preference"
);

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

async function flushMountSettled() {
	await act(async () => {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
	});
}

describe("useCycleEndAudioPreference", () => {
	beforeEach(() => {
		localStorage.clear();
		resetSuggestionFetchPriorityForTests();
		preferenceData = { cycleEndAudioMode: "normal" };
		queryEnabled = false;
		queryIsFetched = false;
		vi.clearAllMocks();
	});

	it("keeps setMode selection when suggestionFetchInFlight flips after initial sync", async () => {
		const scope = { mode: "authenticated" as const, userId: "user-1" };

		const { result } = renderHook(() => useCycleEndAudioPreference(scope), {
			wrapper: createWrapper(),
		});

		await flushMountSettled();

		await waitFor(() => {
			expect(result.current.isHydrated).toBe(true);
		});
		expect(result.current.mode).toBe("normal");

		act(() => {
			result.current.setMode("soft");
		});
		expect(result.current.mode).toBe("soft");

		const dispose = beginSuggestionFetch();
		await act(async () => {
			dispose();
		});

		await waitFor(() => {
			expect(queryEnabled).toBe(true);
		});

		expect(result.current.mode).toBe("soft");
	});

	it("updates guest mode locally without server mutation", () => {
		const scope = { mode: "guest" as const };

		const { result } = renderHook(() => useCycleEndAudioPreference(scope), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.setMode("muted");
		});

		expect(result.current.mode).toBe("muted");
		expect(setMutate).not.toHaveBeenCalled();
		expect(setMutateAsync).not.toHaveBeenCalled();
	});
});
