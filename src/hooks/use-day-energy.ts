"use client";

import { useDayPlan } from "~/hooks/use-day-plan";

/**
 * Focused view over today's "energia dnia" — the per-day energy stored on the
 * DayPlan record. Decouples energy consumers (day-start gate, settings) from
 * the budget-oriented surface of {@link useDayPlan}. Shares the same query
 * cache key, so no extra network round-trip.
 */
export function useDayEnergy() {
	const { energy, setEnergy, isSettingEnergy, isLoading } = useDayPlan();
	return {
		energy,
		setEnergy,
		isSaving: isSettingEnergy,
		isLoading,
	};
}
