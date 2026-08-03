"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { useRepositories } from "~/lib/data-mode/data-mode-context";
import { buildGuestTrendStats } from "~/lib/guest/day-stats";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { TrendPoint } from "~/lib/recap/aggregate-trend-stats";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { getLocalDayBoundary } from "~/lib/time/local-day-boundary";

export type WindowDays = 7 | 30;

// ─── Guest TrendPoint[] via useSyncExternalStore ──────────────────────────────

const emptyGuestTrend: TrendPoint[] = [];

let cachedGuestTrendKey: string | undefined;
let cachedGuestTrend: TrendPoint[] = emptyGuestTrend;

function getGuestTrendSnapshot(windowDays: WindowDays): TrendPoint[] {
	if (typeof window === "undefined") {
		return emptyGuestTrend;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	const localDateKey = formatLocalDateKey();
	const cacheKey = `${localDateKey}::${storageValue ?? ""}::${windowDays}`;
	if (cacheKey === cachedGuestTrendKey) {
		return cachedGuestTrend;
	}

	cachedGuestTrendKey = cacheKey;
	cachedGuestTrend = buildGuestTrendStats(loadSnapshot(), windowDays);
	return cachedGuestTrend;
}

function getGuestTrendServerSnapshot(): TrendPoint[] {
	return emptyGuestTrend;
}

function subscribeGuestTrend(onStoreChange: () => void): () => void {
	const unsubscribeStore = subscribeGuestStore(onStoreChange);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const scheduleNextMidnight = () => {
		const nextMidnight = new Date();
		nextMidnight.setHours(24, 0, 0, 0);
		timeoutId = setTimeout(() => {
			cachedGuestTrendKey = undefined;
			onStoreChange();
			scheduleNextMidnight();
		}, nextMidnight.getTime() - Date.now());
	};

	scheduleNextMidnight();
	return () => {
		unsubscribeStore();
		if (timeoutId != null) {
			clearTimeout(timeoutId);
		}
	};
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrendStats(windowDays: WindowDays) {
	const { mode, recap } = useRepositories();
	const isAuthenticated = mode === "authenticated";

	const { start: todayLocalMidnightUtc, localDateKey: todayLocalDateKey } =
		getLocalDayBoundary();

	const query = useQuery({
		queryKey: [
			"recap.getTrendStats",
			{ todayLocalMidnightUtc, todayLocalDateKey, windowDays },
		],
		queryFn: () =>
			recap.getTrendStats({
				todayLocalMidnightUtc,
				todayLocalDateKey,
				windowDays,
			}),
		enabled: isAuthenticated,
	});

	const getGuestSnapshot = useCallback(
		() => getGuestTrendSnapshot(windowDays),
		[windowDays],
	);

	const guestTrend = useSyncExternalStore(
		subscribeGuestTrend,
		getGuestSnapshot,
		getGuestTrendServerSnapshot,
	);

	return {
		trend: isAuthenticated ? (query.data ?? emptyGuestTrend) : guestTrend,
		isLoading: isAuthenticated && query.isLoading,
		isGuest: !isAuthenticated,
	};
}
