"use client";

import { ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";

import type { DomainTaskId } from "~/lib/data-mode/types";
import type { UserLocale } from "~/lib/domain/user-locale";
import { formatDayMemory } from "~/lib/recap/format-day-memory";
import type { DailyRecap } from "~/lib/recap/types";

type DayMemoryLineProps = {
	recap: DailyRecap;
	tasks: Array<{
		id: DomainTaskId;
		status: string;
		title: string;
		resumeNote?: string | null;
	}>;
	continueTaskId: DomainTaskId | null;
	isLoading?: boolean;
};

export function DayMemoryLine({
	recap,
	tasks,
	continueTaskId,
	isLoading = false,
}: DayMemoryLineProps) {
	const locale = useLocale() as UserLocale;
	const [expanded, setExpanded] = useState(false);

	const dayMemory = formatDayMemory({ recap, tasks, continueTaskId, locale });

	if (isLoading || !dayMemory.hasContent) {
		return null;
	}

	const { sections } = dayMemory;

	return (
		<div
			className="w-full rounded-lg border border-card-border bg-surface-card px-4 py-3 shadow-sm"
			data-testid="day-memory-line"
		>
			<button
				aria-expanded={expanded}
				className="flex w-full items-center gap-2 text-left"
				data-testid="day-memory-toggle"
				onClick={() => setExpanded((value) => !value)}
				type="button"
			>
				<ChevronDown
					aria-hidden="true"
					className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`}
				/>
				<span
					className="text-sm text-text-secondary"
					data-testid="day-memory-collapsed"
				>
					{dayMemory.collapsedLine}
				</span>
			</button>

			{expanded && (
				<div className="mt-3 space-y-3" data-testid="day-memory-expanded">
					{sections.done.items.length > 0 && (
						<section>
							<p className="font-semibold text-sm text-text-section">
								{sections.done.label}
							</p>
							<div className="mt-1 space-y-1">
								{sections.done.items.map((item) => (
									<p
										className="text-sm text-text-secondary"
										key={String(item.taskId)}
									>
										{item.title}
									</p>
								))}
							</div>
						</section>
					)}

					{sections.remains.items.length > 0 && (
						<section>
							<p className="font-semibold text-sm text-text-section">
								{sections.remains.label}
							</p>
							<div className="mt-1 space-y-1">
								{sections.remains.items.map((item) => (
									<p
										className="text-sm text-text-secondary"
										key={String(item.taskId)}
									>
										{item.title}
									</p>
								))}
							</div>
						</section>
					)}

					{sections.returnTo.value != null && (
						<section>
							<p className="font-semibold text-sm text-text-section">
								{sections.returnTo.label}
							</p>
							<p className="mt-1 text-sm text-text-secondary">
								{sections.returnTo.value.resumeNote != null
									? `${sections.returnTo.value.taskTitle} — ${sections.returnTo.value.resumeNote}`
									: sections.returnTo.value.taskTitle}
							</p>
						</section>
					)}
				</div>
			)}
		</div>
	);
}
