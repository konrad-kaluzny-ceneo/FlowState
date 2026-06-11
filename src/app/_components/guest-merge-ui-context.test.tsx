import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { buildMergeSuccessCopy } from "~/lib/guest/merge-copy";

import {
	GuestMergeUiProvider,
	useGuestMergeUi,
} from "./guest-merge-ui-context";

function wrapper({ children }: { children: ReactNode }) {
	return <GuestMergeUiProvider>{children}</GuestMergeUiProvider>;
}

describe("GuestMergeUiProvider", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("hydrates merge success state from sessionStorage on mount", () => {
		const copy = buildMergeSuccessCopy({
			importedTasks: 3,
			importedCycles: 1,
			previewTitles: ["Task C"],
		});
		sessionStorage.setItem(
			"flowstate:merge-success-pending",
			JSON.stringify(copy),
		);

		const { result } = renderHook(() => useGuestMergeUi(), { wrapper });

		expect(result.current.mergeSuccessVisible).toBe(true);
		expect(result.current.mergeSuccessCopy).toEqual(copy);
	});

	it("exposes merge success state after showMergeSuccess", () => {
		const { result } = renderHook(() => useGuestMergeUi(), { wrapper });
		const copy = buildMergeSuccessCopy({
			importedTasks: 2,
			importedCycles: 0,
			previewTitles: ["Task A"],
		});

		act(() => {
			result.current.showMergeSuccess(copy);
		});

		expect(result.current.mergeSuccessVisible).toBe(true);
		expect(result.current.mergeSuccessCopy).toEqual(copy);
	});

	it("dismissMergeSuccess clears visible state and sessionStorage", () => {
		const { result } = renderHook(() => useGuestMergeUi(), { wrapper });
		const copy = buildMergeSuccessCopy({
			importedTasks: 1,
			importedCycles: 0,
			previewTitles: ["Task B"],
		});

		act(() => {
			result.current.showMergeSuccess(copy);
		});

		act(() => {
			result.current.dismissMergeSuccess();
		});

		expect(result.current.mergeSuccessVisible).toBe(false);
		expect(result.current.mergeSuccessCopy).toBeNull();
		expect(
			sessionStorage.getItem("flowstate:merge-success-pending"),
		).toBeNull();
	});
});
