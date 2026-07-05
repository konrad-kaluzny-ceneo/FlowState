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
	sessionsCompleted?: number;
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
	sessionsCompleted = 0,
}: HomeFocusSummaryProps) {
	const t = useTranslations("HomeFocusSummary");

	const lines = useMemo(() => {
		const result: string[] = [];

		if (sessionsCompleted > 0) {
			result.push(t("sessionsLine", { count: sessionsCompleted }));
		}

		const openStanding = standingTasks.filter((task) => !task.doneForToday);
		const doneStanding = standingTasks.filter((task) => task.doneForToday);

		if (openStanding.length > 0) {
			result.push(t("standingOpen", { count: openStanding.length }));
		} else if (doneStanding.length > 0) {
			result.push(t("standingDone", { count: doneStanding.length }));
		}

		return result;
	}, [sessionsCompleted, standingTasks, t]);

	const budgetProgressPct =
		hasBudget && budgetMinutes != null && budgetMinutes > 0
			? Math.min(100, Math.round((usedMinutes / budgetMinutes) * 100))
			: null;

	if (isLoading || (lines.length === 0 && budgetProgressPct == null)) {
		return null;
	}

	return (
		<div
			className="w-full rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-3"
			data-testid="home-focus-summary"
		>
			<p className="font-medium text-primary text-sm">{t("heading")}</p>
			{budgetProgressPct != null &&
				budgetMinutes != null &&
				remainingMinutes != null && (
					<div className="mt-2">
						<p className="text-text-secondary text-xs">
							{t("budgetLine", {
								used: formatFocusMinutes(usedMinutes),
								budget: formatFocusMinutes(budgetMinutes),
								remaining: formatFocusMinutes(remainingMinutes),
							})}
						</p>
						<div
							aria-hidden="true"
							className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-segment-inactive"
						>
							<div
								className="h-full rounded-full bg-accent-cta transition-[width]"
								style={{ width: `${budgetProgressPct}%` }}
							/>
						</div>
					</div>
				)}
			{lines.map((line) => (
				<p className="mt-1 text-sm text-text-secondary" key={line}>
					{line}
				</p>
			))}
		</div>
	);
}
