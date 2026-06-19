import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataModeProvider, useRepositories } from "./data-mode-context";

const mockFetch = vi.fn();
const mockMutate = vi.fn();

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			client: {
				task: {
					list: { query: mockFetch },
					create: { mutate: mockMutate },
					update: { mutate: mockMutate },
					delete: { mutate: mockMutate },
					reorder: { mutate: mockMutate },
				},
				cycle: {
					getActive: { query: mockFetch },
					create: { mutate: mockMutate },
					complete: { mutate: mockMutate },
					interrupt: { mutate: mockMutate },
					pause: { mutate: mockMutate },
					resume: { mutate: mockMutate },
					rebindTask: { mutate: mockMutate },
				},
				session: {
					getOrCreateActive: { mutate: mockMutate },
					end: { mutate: mockMutate },
				},
			},
		}),
	},
}));

describe("DataModeProvider", () => {
	it("wires guest repositories with no-op refreshGuest", () => {
		const { result } = renderHook(() => useRepositories(), {
			wrapper: ({ children }) => (
				<DataModeProvider mode="guest">{children}</DataModeProvider>
			),
		});

		expect(result.current.mode).toBe("guest");
		expect(result.current.tasks).toBeDefined();
		expect(result.current.cycles).toBeDefined();
		expect(result.current.sessions).toBeDefined();
		expect(result.current.refreshGuest()).toBeUndefined();
	});

	it("wires authenticated server repositories from tRPC utils", () => {
		const { result } = renderHook(() => useRepositories(), {
			wrapper: ({ children }) => (
				<DataModeProvider mode="authenticated">{children}</DataModeProvider>
			),
		});

		expect(result.current.mode).toBe("authenticated");
		expect(typeof result.current.tasks.list).toBe("function");
		expect(typeof result.current.cycles.getActive).toBe("function");
		expect(typeof result.current.sessions.getOrCreateActive).toBe("function");
		expect(result.current.refreshGuest()).toBeUndefined();
	});
});
