"use client";

import {
	createContext,
	createElement,
	type ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";

import type { MergeSuccessCopy } from "~/lib/guest/merge-copy";
import { setMergeSuccessVisible } from "~/lib/onboarding/defer";

const MERGE_SUCCESS_SESSION_KEY = "flowstate:merge-success-pending";

function readPendingMergeCopy(): MergeSuccessCopy | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const raw = sessionStorage.getItem(MERGE_SUCCESS_SESSION_KEY);
		if (raw == null) {
			return null;
		}
		return JSON.parse(raw) as MergeSuccessCopy;
	} catch {
		return null;
	}
}

function writePendingMergeCopy(copy: MergeSuccessCopy): void {
	sessionStorage.setItem(MERGE_SUCCESS_SESSION_KEY, JSON.stringify(copy));
}

function clearPendingMergeCopy(): void {
	sessionStorage.removeItem(MERGE_SUCCESS_SESSION_KEY);
}

type GuestMergeUiContextValue = {
	mergeSuccessCopy: MergeSuccessCopy | null;
	mergeSuccessVisible: boolean;
	dismissMergeSuccess: () => void;
	showMergeSuccess: (copy: MergeSuccessCopy) => void;
};

const GuestMergeUiContext = createContext<GuestMergeUiContextValue | null>(
	null,
);

export function GuestMergeUiProvider({ children }: { children: ReactNode }) {
	// SSR-safe: hydrate pending merge copy from sessionStorage after mount only.
	const [mergeSuccessCopy, setMergeSuccessCopy] =
		useState<MergeSuccessCopy | null>(null);
	const [mergeSuccessVisible, setMergeSuccessVisibleState] = useState(false);

	useLayoutEffect(() => {
		const pending = readPendingMergeCopy();
		if (pending == null) {
			return;
		}

		setMergeSuccessCopy(pending);
		setMergeSuccessVisibleState(true);
		setMergeSuccessVisible(true);
	}, []);

	const showMergeSuccess = useCallback((copy: MergeSuccessCopy) => {
		writePendingMergeCopy(copy);
		setMergeSuccessCopy(copy);
		setMergeSuccessVisibleState(true);
		setMergeSuccessVisible(true);
	}, []);

	const dismissMergeSuccess = useCallback(() => {
		clearPendingMergeCopy();
		setMergeSuccessCopy(null);
		setMergeSuccessVisibleState(false);
		setMergeSuccessVisible(false);
	}, []);

	const value = useMemo(
		() => ({
			mergeSuccessCopy,
			mergeSuccessVisible,
			dismissMergeSuccess,
			showMergeSuccess,
		}),
		[
			mergeSuccessCopy,
			mergeSuccessVisible,
			dismissMergeSuccess,
			showMergeSuccess,
		],
	);

	return createElement(GuestMergeUiContext.Provider, { value }, children);
}

export function useGuestMergeUi(): GuestMergeUiContextValue {
	const context = useContext(GuestMergeUiContext);
	if (context == null) {
		throw new Error("useGuestMergeUi must be used within GuestMergeUiProvider");
	}

	return context;
}
