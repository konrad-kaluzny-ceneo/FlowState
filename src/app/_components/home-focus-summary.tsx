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
	variant?: "widget" | "embedded";
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
	variant = "widget",
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

	const loadingBody = (
		<dl className="space-y-2 text-sm">
			{[1, 2, 3].map((row) => (
				<div className="flex items-center justify-between gap-3" key={row}>
					<dt
						aria-hidden="true"
						className="h-4 w-24 animate-pulse rounded bg-surface-panel"
					/>
					<dd
						aria-hidden="true"
						className="h-4 w-12 animate-pulse rounded bg-surface-panel"
					/>
				</div>
			))}
			<div
				aria-hidden="true"
				className="mt-4 h-2 w-full animate-pulse rounded-full bg-surface-panel"
			/>
		</dl>
	);

	if (isLoading && forceShow) {
		if (variant === "embedded") {
			return loadingBody;
		}

		return (
			<FocusWidgetCard testId="home-focus-summary" title={t("heading")}>
				{loadingBody}
			</FocusWidgetCard>
		);
	}

	const summaryBody = (
		<>
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
		</>
	);

	if (variant === "embedded") {
		return summaryBody;
	}

	return (
		<FocusWidgetCard testId="home-focus-summary" title={t("heading")}>
			{summaryBody}
		</FocusWidgetCard>
	);
}
