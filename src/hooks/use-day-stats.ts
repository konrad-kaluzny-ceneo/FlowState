"use client";

import { useSyncExternalStore } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { buildGuestDayStats } from "~/lib/guest/day-stats";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { DayStats } from "~/lib/recap/aggregate-day-stats";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import { api } from "~/trpc/react";

// ─── Guest DayStats via useSyncExternalStore ──────────────────────────────────

const emptyGuestDayStats: DayStats = {
	tasksWithFocusCount: 0,
	doneTasksCount: 0,
	focusMinutes: 0,
	breakMinutes: 0,
	sessionCount: 0,
	avgSessionMinutes: 0,
	hourBuckets: Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		focusMinutes: 0,
	})),
	workTypeStats: [],
	taskCompletionStat: { done: 0, partial: 0, undone: 0 },
};

let cachedGuestDayStatsKey: string | undefined;
let cachedGuestDayStats: DayStats = emptyGuestDayStats;

function getGuestDayStatsSnapshot(): DayStats {
	if (typeof window === "undefined") {
		return emptyGuestDayStats;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	const cacheKey = storageValue ?? "";
	if (cacheKey === cachedGuestDayStatsKey) {
		return cachedGuestDayStats;
	}

	cachedGuestDayStatsKey = cacheKey;
	cachedGuestDayStats = buildGuestDayStats(loadSnapshot());
	return cachedGuestDayStats;
}

function getGuestDayStatsServerSnapshot(): DayStats {
	return emptyGuestDayStats;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDayStats() {
	const mode = useDataMode();
	const localDateKey = formatLocalDateKey();
	const isAuthenticated = mode === "authenticated";

	const query = api.recap.getDayStats.useQuery(
		{ localDateKey },
		{ enabled: isAuthenticated },
	);

	const guestStats = useSyncExternalStore(
		subscribeGuestStore,
		getGuestDayStatsSnapshot,
		getGuestDayStatsServerSnapshot,
	);

	return {
		stats: isAuthenticated ? (query.data ?? null) : guestStats,
		isLoading: isAuthenticated && query.isLoading,
		isGuest: !isAuthenticated,
	};
}
