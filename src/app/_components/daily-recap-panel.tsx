"use client";

import { ChevronDown, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { DailyRecap, RecapTaskRow, TodayPlanRow } from "~/lib/recap/types";

const DISMISS_KEY_PREFIX = "flowstate:daily-recap-dismiss:";

type DailyRecapPanelProps = {
	localDateKey: string;
	recap: DailyRecap;
	isLoading?: boolean;
};

function isDismissedForDate(localDateKey: string): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${localDateKey}`) === "1";
}

function dismissForDate(localDateKey: string): void {
	sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${localDateKey}`, "1");
}

function formatTimeRange(row: RecapTaskRow, locale: string): string {
	const options: Intl.DateTimeFormatOptions = {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};
	const start = row.firstStartedAt.toLocaleTimeString(locale, options);
	const end = row.lastEndedAt.toLocaleTimeString(locale, options);
	return `${start}–${end}`;
}

function SectionToggle({
	expanded,
	label,
	onToggle,
	testId,
}: {
	expanded: boolean;
	label: string;
	onToggle: () => void;
	testId: string;
}) {
	return (
		<button
			aria-expanded={expanded}
			className="flex items-center gap-1 font-semibold text-sm text-text-section"
			data-testid={testId}
			onClick={onToggle}
			type="button"
		>
			<ChevronDown
				aria-hidden="true"
				className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
			/>
			{label}
		</button>
	);
}

export function DailyRecapPanel({
	localDateKey,
	recap,
	isLoading = false,
}: DailyRecapPanelProps) {
	const locale = useLocale();
	const t = useTranslations("Recap");
	const [dismissed, setDismissed] = useState(false);
	const [last24Expanded, setLast24Expanded] = useState(false);
	const [todayExpanded, setTodayExpanded] = useState(false);
	const hasLast24Hours = recap.last24Hours.length > 0;

	const formatRecapRow = useCallback(
		(row: RecapTaskRow): string => {
			const label = row.completedWithoutCycle
				? t("markedDone", { title: row.title })
				: row.title;
			return t("rowFormat", {
				label,
				minutes: row.focusedMinutes,
				range: formatTimeRange(row, locale),
			});
		},
		[locale, t],
	);

	const formatTodayRow = useCallback(
		(row: TodayPlanRow): string => {
			const parts: string[] = [];
			if (row.isDailyStanding) {
				parts.push(t("todayDailyTag"));
			}
			if (row.doneForToday) {
				parts.push(t("todayDoneTag"));
			}
			if (row.effortMinutes != null) {
				parts.push(`${row.effortMinutes}m`);
			}
			parts.push(row.title);
			return parts.join(" · ");
		},
		[t],
	);

	useEffect(() => {
		setDismissed(isDismissedForDate(localDateKey));
		setLast24Expanded(false);
		setTodayExpanded(false);
	}, [localDateKey]);

	const handleDismiss = useCallback(() => {
		dismissForDate(localDateKey);
		setDismissed(true);
	}, [localDateKey]);

	if (dismissed || isLoading) {
		return null;
	}

	return (
		<div
			className="w-full rounded-lg border border-card-border bg-surface-card px-4 py-3 shadow-sm"
			data-testid="daily-recap-panel"
		>
			<div className="flex items-start justify-between gap-3">
				<p className="font-semibold text-sm text-text-section">{t("title")}</p>
				<button
					aria-label={t("dismissAria")}
					className="shrink-0 rounded-md p-1 text-text-dimmed hover:text-text-section focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
					data-testid="daily-recap-dismiss"
					onClick={handleDismiss}
					type="button"
				>
					<X aria-hidden="true" className="h-4 w-4" />
				</button>
			</div>

			<div className="mt-3 space-y-3">
				{hasLast24Hours && (
					<section>
						<SectionToggle
							expanded={last24Expanded}
							label={t("sectionLast24")}
							onToggle={() => setLast24Expanded((value) => !value)}
							testId="daily-recap-last24-toggle"
						/>
						{last24Expanded && (
							<div className="mt-2 space-y-1" data-testid="daily-recap-last24">
								{recap.last24Hours.map((row) => (
									<p
										className="text-sm text-text-secondary"
										key={String(row.taskId)}
									>
										{formatRecapRow(row)}
									</p>
								))}
							</div>
						)}
					</section>
				)}

				<section>
					<SectionToggle
						expanded={todayExpanded}
						label={t("sectionToday")}
						onToggle={() => setTodayExpanded((value) => !value)}
						testId="daily-recap-today-toggle"
					/>
					{todayExpanded && (
						<div className="mt-2 space-y-1" data-testid="daily-recap-today">
							{recap.todayPlan.length === 0 ? (
								<p className="text-sm text-text-secondary">{t("todayEmpty")}</p>
							) : (
								recap.todayPlan.map((row) => (
									<p
										className="text-sm text-text-secondary"
										key={String(row.taskId)}
									>
										{formatTodayRow(row)}
									</p>
								))
							)}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
