import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME } from "~/i18n/routing";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh }),
}));

vi.mock("next-intl", () => ({
	useLocale: () => "en",
}));

let preferenceData: {
	cycleEndAudioMode: "normal";
	language: "en" | "pl" | null;
} = {
	cycleEndAudioMode: "normal",
	language: null,
};
let queryEnabled = false;
let queryIsFetched = false;

const setPreferenceData = vi.fn();
const setMutateAsync = vi
	.fn()
	.mockImplementation(async (input: { language?: "en" | "pl" }) => {
		if (input.language !== undefined) {
			preferenceData = { ...preferenceData, language: input.language };
		}
	});

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
				useMutation: (opts?: {
					onSuccess?: (data: typeof preferenceData) => void;
				}) => ({
					mutateAsync: async (input: { language?: "en" | "pl" }) => {
						await setMutateAsync(input);
						const next = {
							cycleEndAudioMode: preferenceData.cycleEndAudioMode,
							language: input.language ?? preferenceData.language,
						};
						opts?.onSuccess?.(next);
						return next;
					},
				}),
			},
		},
	},
}));

const { useLanguagePreference } = await import(
	"~/hooks/use-language-preference"
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

function readLocaleCookie(): string | null {
	const match = document.cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${LOCALE_COOKIE_NAME}=`));
	return match?.split("=")[1] ?? null;
}

describe("useLanguagePreference", () => {
	beforeEach(() => {
		localStorage.clear();
		// biome-ignore lint/suspicious/noDocumentCookie: test harness clears locale cookie between cases.
		document.cookie = `${LOCALE_COOKIE_NAME}=; max-age=0; path=/`;
		preferenceData = { cycleEndAudioMode: "normal", language: null };
		queryEnabled = false;
		queryIsFetched = false;
		vi.clearAllMocks();
	});

	it("updates guest locale in cookie and localStorage without server mutation", () => {
		const scope = { mode: "guest" as const };

		const { result } = renderHook(() => useLanguagePreference(scope), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.setLocale("pl");
		});

		expect(readLocaleCookie()).toBe("pl");
		expect(localStorage.getItem("flowstate:language:guest")).toBe('"pl"');
		expect(setMutateAsync).not.toHaveBeenCalled();
		expect(refresh).toHaveBeenCalled();
	});

	it("persists authenticated locale through tRPC and cookie", async () => {
		const scope = { mode: "authenticated" as const, userId: "user-1" };

		const { result } = renderHook(() => useLanguagePreference(scope), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(queryEnabled).toBe(true);
		});

		act(() => {
			void result.current.setLocale("pl");
		});

		await waitFor(() => {
			expect(setMutateAsync).toHaveBeenCalledWith({ language: "pl" });
		});
		expect(readLocaleCookie()).toBe("pl");
		expect(localStorage.getItem("flowstate:language:user-1")).toBe('"pl"');
		await waitFor(() => {
			expect(refresh).toHaveBeenCalled();
		});
	});

	it("keeps optimistic locale when account persistence fails", async () => {
		setMutateAsync.mockRejectedValueOnce(new Error("network"));
		const scope = { mode: "authenticated" as const, userId: "user-1" };

		const { result } = renderHook(() => useLanguagePreference(scope), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(queryEnabled).toBe(true);
		});

		act(() => {
			void result.current.setLocale("pl");
		});

		await waitFor(() => {
			expect(result.current.persistError).not.toBeNull();
		});
		expect(readLocaleCookie()).toBe("pl");
		expect(refresh).not.toHaveBeenCalled();
	});
});
