"use client";

import { useTranslations } from "next-intl";

import { FocusWidgetCard } from "~/app/_components/focus-widget-card";
import { formatFocusMinutes } from "~/lib/time/format-focus-minutes";

type HomeFocusSummaryProps = {
	hasBudget: boolean;
	isLoading: boolean;
	budgetMinutes: number | null;
	remainingMinutes: number | null;
	usedMinutes: number;
	sessionsCompleted?: number;
	tasksDone?: number;
	tasksTotal?: number;
	/** Always render the widget (calm landing rail). */
	forceShow?: boolean;
};

export function HomeFocusSummary({
	hasBudget,
	isLoading,
	budgetMinutes,
	remainingMinutes,
	usedMinutes,
	sessionsCompleted = 0,
	tasksDone = 0,
	tasksTotal = 0,
	forceShow = false,
}: HomeFocusSummaryProps) {
	const t = useTranslations("HomeFocusSummary");

	const budgetProgressPct =
		hasBudget && budgetMinutes != null && budgetMinutes > 0
			? Math.min(100, Math.round((usedMinutes / budgetMinutes) * 100))
			: null;

	if (!forceShow && isLoading) {
		return null;
	}

	if (!forceShow && !hasBudget && sessionsCompleted === 0) {
		return null;
	}

	return (
		<FocusWidgetCard testId="home-focus-summary" title={t("heading")}>
			<dl className="space-y-2 text-sm">
				<div className="flex items-center justify-between gap-3">
					<dt className="text-text-secondary">{t("tasksLabel")}</dt>
					<dd className="font-medium text-primary">
						{t("tasksLine", { done: tasksDone, total: tasksTotal })}
					</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-text-secondary">{t("sessionsLabel")}</dt>
					<dd className="font-medium text-primary">{sessionsCompleted}</dd>
				</div>
				<div className="flex items-center justify-between gap-3">
					<dt className="text-text-secondary">{t("focusTimeLabel")}</dt>
					<dd className="font-medium text-primary">
						{t("focusTimeLine", { minutes: usedMinutes })}
					</dd>
				</div>
			</dl>

			{budgetProgressPct != null &&
			budgetMinutes != null &&
			remainingMinutes != null ? (
				<div className="mt-4">
					<p className="text-text-secondary text-xs">
						{t("budgetLine", {
							used: formatFocusMinutes(usedMinutes),
							budget: formatFocusMinutes(budgetMinutes),
							remaining: formatFocusMinutes(remainingMinutes),
						})}
					</p>
					<div
						aria-hidden="true"
						className="mt-2 h-2 w-full overflow-hidden rounded-full bg-segment-inactive"
					>
						<div
							className="h-full rounded-full bg-accent-cta transition-[width]"
							style={{ width: `${budgetProgressPct}%` }}
						/>
					</div>
				</div>
			) : (
				<p className="mt-4 text-text-dimmed text-xs">{t("emptyPlan")}</p>
			)}
		</FocusWidgetCard>
	);
}
