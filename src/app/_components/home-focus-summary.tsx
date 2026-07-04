"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

type StandingTaskFact = {
	title: string;
	doneForToday: boolean;
};

type HomeFocusSummaryProps = {
	hasBudget: boolean;
	isLoading: boolean;
	budgetMinutes: number | null;
	remainingMinutes: number | null;
	usedMinutes: number;
	standingTasks: StandingTaskFact[];
};

function formatFocusMinutes(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours > 0 && mins > 0) {
		return `${hours}h ${mins}m`;
	}
	if (hours > 0) {
		return `${hours}h`;
	}
	return `${mins}m`;
}

export function HomeFocusSummary({
	hasBudget,
	isLoading,
	budgetMinutes,
	remainingMinutes,
	usedMinutes,
	standingTasks,
}: HomeFocusSummaryProps) {
	const t = useTranslations("HomeFocusSummary");

	const lines = useMemo(() => {
		const result: string[] = [];

		if (hasBudget && budgetMinutes != null && remainingMinutes != null) {
			result.push(
				t("budgetLine", {
					used: formatFocusMinutes(usedMinutes),
					budget: formatFocusMinutes(budgetMinutes),
					remaining: formatFocusMinutes(remainingMinutes),
				}),
			);
		}

		const openStanding = standingTasks.filter((task) => !task.doneForToday);
		const doneStanding = standingTasks.filter((task) => task.doneForToday);

		if (openStanding.length > 0) {
			result.push(t("standingOpen", { count: openStanding.length }));
		} else if (doneStanding.length > 0) {
			result.push(t("standingDone", { count: doneStanding.length }));
		}

		return result;
	}, [
		budgetMinutes,
		hasBudget,
		remainingMinutes,
		standingTasks,
		t,
		usedMinutes,
	]);

	if (isLoading || lines.length === 0) {
		return null;
	}

	return (
		<div
			className="w-full rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-3"
			data-testid="home-focus-summary"
		>
			{lines.map((line) => (
				<p className="text-sm text-text-secondary" key={line}>
					{line}
				</p>
			))}
		</div>
	);
}
