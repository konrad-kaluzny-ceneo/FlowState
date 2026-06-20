"use client";

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

function formatTimeRange(row: RecapTaskRow): string {
	const options: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		minute: "2-digit",
	};
	const start = row.firstStartedAt.toLocaleTimeString([], options);
	const end = row.lastEndedAt.toLocaleTimeString([], options);
	return `${start}–${end}`;
}

function formatRecapRow(row: RecapTaskRow): string {
	const label = row.completedWithoutCycle
		? `Marked done · ${row.title}`
		: row.title;
	return `${label} · ${row.focusedMinutes}m · ${formatTimeRange(row)}`;
}

function formatTodayRow(row: TodayPlanRow): string {
	const parts: string[] = [];
	if (row.isDailyStanding) {
		parts.push("Daily");
	}
	if (row.doneForToday) {
		parts.push("Done today");
	}
	if (row.effortMinutes != null) {
		parts.push(`${row.effortMinutes}m`);
	}
	parts.push(row.title);
	return parts.join(" · ");
}

export function DailyRecapPanel({
	localDateKey,
	recap,
	isLoading = false,
}: DailyRecapPanelProps) {
	const [dismissed, setDismissed] = useState(() =>
		isDismissedForDate(localDateKey),
	);
	const [last24Expanded, setLast24Expanded] = useState(true);
	const [todayExpanded, setTodayExpanded] = useState(true);

	useEffect(() => {
		setDismissed(isDismissedForDate(localDateKey));
		setLast24Expanded(true);
		setTodayExpanded(true);
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
			className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-panel px-4 py-3"
			data-testid="daily-recap-panel"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-1">
					<p className="font-semibold text-sm text-text-section">Daily recap</p>
					<p className="text-text-secondary text-xs">
						Light timing for standups — list only, no charts.
					</p>
				</div>
				<button
					aria-label="Dismiss daily recap"
					className="shrink-0 text-text-dimmed text-xs hover:text-text-section"
					data-testid="daily-recap-dismiss"
					onClick={handleDismiss}
					type="button"
				>
					Not now
				</button>
			</div>

			<div className="mt-3 space-y-3">
				<section>
					<button
						aria-expanded={last24Expanded}
						className="font-semibold text-sm text-text-section underline-offset-2 transition hover:underline"
						data-testid="daily-recap-last24-toggle"
						onClick={() => setLast24Expanded((value) => !value)}
						type="button"
					>
						Last 24 hours
					</button>
					{last24Expanded && (
						<div className="mt-2 space-y-1" data-testid="daily-recap-last24">
							{recap.last24Hours.length === 0 ? (
								<p className="text-sm text-text-secondary">
									No focused work in the last 24 hours yet.
								</p>
							) : (
								recap.last24Hours.map((row) => (
									<p
										className="text-sm text-text-secondary"
										key={String(row.taskId)}
									>
										{formatRecapRow(row)}
									</p>
								))
							)}
						</div>
					)}
				</section>

				<section>
					<button
						aria-expanded={todayExpanded}
						className="font-semibold text-sm text-text-section underline-offset-2 transition hover:underline"
						data-testid="daily-recap-today-toggle"
						onClick={() => setTodayExpanded((value) => !value)}
						type="button"
					>
						Today
					</button>
					{todayExpanded && (
						<div className="mt-2 space-y-1" data-testid="daily-recap-today">
							{recap.todayPlan.length === 0 ? (
								<p className="text-sm text-text-secondary">
									Nothing on today&apos;s plan yet.
								</p>
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
