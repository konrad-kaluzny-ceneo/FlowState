"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { buildGuestDayStats } from "~/lib/guest/day-stats";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { loadSnapshot, subscribeGuestStore } from "~/lib/guest/store";
import type { DayStats } from "~/lib/recap/aggregate-day-stats";
import { formatLocalDateKey } from "~/lib/time/local-date-key";
import {
	getLocalDayBoundary,
	type LocalDayBoundary,
} from "~/lib/time/local-day-boundary";
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

function getGuestDayStatsSnapshot(boundary: LocalDayBoundary): DayStats {
	if (typeof window === "undefined") {
		return emptyGuestDayStats;
	}

	const storageValue = localStorage.getItem(GUEST_STORAGE_KEY);
	const cacheKey = `${storageValue ?? ""}::${boundary.localDateKey}`;
	if (cacheKey === cachedGuestDayStatsKey) {
		return cachedGuestDayStats;
	}

	cachedGuestDayStatsKey = cacheKey;
	cachedGuestDayStats = buildGuestDayStats(loadSnapshot(), boundary);
	return cachedGuestDayStats;
}

function getGuestDayStatsServerSnapshot(): DayStats {
	return emptyGuestDayStats;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDayStats() {
	const mode = useDataMode();
	const isAuthenticated = mode === "authenticated";

	const [viewedDate, setViewedDate] = useState(() => new Date());
	const boundary = getLocalDayBoundary(viewedDate);
	const todayLocalDateKey = formatLocalDateKey();

	const query = api.recap.getDayStats.useQuery(
		{ rangeStart: boundary.start, rangeEnd: boundary.end },
		{ enabled: isAuthenticated },
	);

	const boundaryStartMs = boundary.start.getTime();
	const boundaryEndMs = boundary.end.getTime();
	const boundaryLocalDateKey = boundary.localDateKey;
	const getGuestSnapshot = useCallback(
		() =>
			getGuestDayStatsSnapshot({
				start: new Date(boundaryStartMs),
				end: new Date(boundaryEndMs),
				localDateKey: boundaryLocalDateKey,
			}),
		[boundaryStartMs, boundaryEndMs, boundaryLocalDateKey],
	);

	const guestStats = useSyncExternalStore(
		subscribeGuestStore,
		getGuestSnapshot,
		getGuestDayStatsServerSnapshot,
	);

	const goToPreviousDay = useCallback(() => {
		setViewedDate(
			(d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1),
		);
	}, []);

	const goToNextDay = useCallback(() => {
		setViewedDate(
			(d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
		);
	}, []);

	const goToToday = useCallback(() => {
		setViewedDate(new Date());
	}, []);

	return {
		stats: isAuthenticated ? (query.data ?? null) : guestStats,
		isLoading: isAuthenticated && query.isLoading,
		isGuest: !isAuthenticated,
		viewedDate,
		viewedLocalDateKey: boundary.localDateKey,
		goToPreviousDay,
		goToNextDay,
		goToToday,
		canGoNext: boundary.localDateKey !== todayLocalDateKey,
	};
}
