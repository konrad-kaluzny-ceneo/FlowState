"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { buildGuestTrendStats } from "~/lib/guest/day-stats";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { TrendPoint } from "~/lib/recap/aggregate-trend-stats";
import { getLocalDayBoundary } from "~/lib/time/local-day-boundary";
import { api } from "~/trpc/react";

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
	const cacheKey = `${storageValue ?? ""}::${windowDays}`;
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrendStats(windowDays: WindowDays) {
	const mode = useDataMode();
	const isAuthenticated = mode === "authenticated";

	const todayLocalMidnightUtc = getLocalDayBoundary().start;

	const query = api.recap.getTrendStats.useQuery(
		{ todayLocalMidnightUtc, windowDays },
		{ enabled: isAuthenticated },
	);

	const getGuestSnapshot = useCallback(
		() => getGuestTrendSnapshot(windowDays),
		[windowDays],
	);

	const guestTrend = useSyncExternalStore(
		subscribeGuestStore,
		getGuestSnapshot,
		getGuestTrendServerSnapshot,
	);

	return {
		trend: isAuthenticated ? (query.data ?? emptyGuestTrend) : guestTrend,
		isLoading: isAuthenticated && query.isLoading,
		isGuest: !isAuthenticated,
	};
}
