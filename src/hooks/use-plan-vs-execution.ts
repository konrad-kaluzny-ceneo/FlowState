"use client";

import type { WindowDays } from "~/hooks/use-trend-stats";
import { useTrendStats } from "~/hooks/use-trend-stats";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { getLocalDayBoundaries } from "~/lib/time/local-day-boundary";
import { api } from "~/trpc/react";

export type PlanVsExecutionPoint = {
	localDateKey: string;
	plannedMinutes: number | null;
	actualMinutes: number;
};

const emptyPoints: PlanVsExecutionPoint[] = [];

/**
 * Authenticated-only — plan-vs-execution has no guest equivalent (see plan.md
 * "What We're NOT Doing": no guest-mode focus-budget feature). Guests get
 * `isAvailable: false` and never fetch.
 */
export function usePlanVsExecution(windowDays: WindowDays) {
	const mode = useDataMode();
	const isAuthenticated = mode === "authenticated";

	const { trend, isLoading: isTrendLoading } = useTrendStats(windowDays);

	const localDateKeys = trend.map((p) => p.localDateKey);
	const fallbackKeys = getLocalDayBoundaries(windowDays).map(
		(b) => b.localDateKey,
	);
	const keysForRangeQuery =
		localDateKeys.length > 0 ? localDateKeys : fallbackKeys;

	const rangeQuery = api.dayPlan.getRange.useQuery(
		{ localDateKeys: keysForRangeQuery },
		{ enabled: isAuthenticated },
	);

	if (!isAuthenticated) {
		return {
			trend,
			points: emptyPoints,
			isLoading: false,
			isAvailable: false,
		};
	}

	const budgetByKey = new Map(
		(rangeQuery.data ?? []).map((row) => [
			row.localDateKey,
			row.focusBudgetMinutes,
		]),
	);

	const points: PlanVsExecutionPoint[] = trend.map((point) => {
		const planned = budgetByKey.get(point.localDateKey);
		return {
			localDateKey: point.localDateKey,
			plannedMinutes: (planned !== undefined ? planned : null) as number | null,
			actualMinutes: point.focusMinutes,
		};
	});

	return {
		trend,
		points,
		isLoading: isTrendLoading || rangeQuery.isLoading,
		isAvailable: true,
	};
}
