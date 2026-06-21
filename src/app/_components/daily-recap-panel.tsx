"use client";

import { ChevronDown, X } from "lucide-react";
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
	const [dismissed, setDismissed] = useState(() =>
		isDismissedForDate(localDateKey),
	);
	const [last24Expanded, setLast24Expanded] = useState(true);
	const [todayExpanded, setTodayExpanded] = useState(true);
	const hasLast24Hours = recap.last24Hours.length > 0;

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
			className="w-full max-w-lg rounded-lg border border-card-border bg-surface-card px-4 py-3 shadow-sm"
			data-testid="daily-recap-panel"
		>
			<div className="flex items-start justify-between gap-3">
				<p className="font-semibold text-sm text-text-section">Daily recap</p>
				<button
					aria-label="Dismiss daily recap"
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
							label="Last 24 hours"
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
						label="Today"
						onToggle={() => setTodayExpanded((value) => !value)}
						testId="daily-recap-today-toggle"
					/>
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
