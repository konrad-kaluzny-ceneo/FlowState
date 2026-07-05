"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { DomainTask, DomainTaskStatus } from "~/lib/data-mode/types";
import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";
import {
	getWorkTypeLabel,
	WORK_TYPE_CONFIG,
	type WorkTypeKey,
} from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import { formatFocusMinutes } from "~/lib/time/format-focus-minutes";

type FocusReadyStateProps = {
	tasks: DomainTask[];
	onAddTask: () => void;
	onSelectTask: (task: DomainTask) => void;
};

const FOCUS_READY_STATUSES = new Set<DomainTaskStatus>(["active", "planned"]);

function focusReadyStatusRank(status: DomainTaskStatus): number {
	if (status === "active") {
		return 0;
	}
	if (status === "planned") {
		return 1;
	}
	return 2;
}

export function selectFocusReadyTasks(tasks: DomainTask[]): DomainTask[] {
	return tasks
		.filter((task) => FOCUS_READY_STATUSES.has(task.status))
		.sort((a, b) => {
			const rankDiff =
				focusReadyStatusRank(a.status) - focusReadyStatusRank(b.status);
			if (rankDiff !== 0) {
				return rankDiff;
			}
			return a.sortOrder - b.sortOrder;
		})
		.slice(0, 3);
}

export function FocusReadyState({
	tasks,
	onAddTask,
	onSelectTask,
}: FocusReadyStateProps) {
	const t = useTranslations("FocusReady");
	const locale = useLocale() as UserLocale;
	const suggestedTasks = selectFocusReadyTasks(tasks);

	return (
		<div
			className="focus-ready-hero w-full overflow-hidden rounded-card border border-card-border bg-surface-card shadow-sm"
			data-testid="focus-ready-state"
		>
			<div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-cta/10">
					<CalmGardenSprig className="h-8 w-8" variant="work" />
				</div>
				<div>
					<h2 className="font-semibold text-primary text-xl">{t("heading")}</h2>
					<p className="mt-2 max-w-sm text-sm text-text-secondary">
						{t("subtitle")}
					</p>
				</div>
				<button
					className="rounded-control bg-accent-cta px-6 py-3 font-semibold text-on-cta text-sm transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
					data-testid="focus-ready-choose-task"
					onClick={() => {
						const first = suggestedTasks[0];
						if (first != null) {
							onSelectTask(first);
							return;
						}
						onAddTask();
					}}
					type="button"
				>
					{t("cta")}
				</button>
			</div>

			{suggestedTasks.length > 0 && (
				<div className="border-border-subtle border-t px-6 py-5">
					<p className="mb-3 font-medium text-text-section text-xs">
						{t("suggestedHeading")}
					</p>
					<ul className="space-y-2">
						{suggestedTasks.map((task) => {
							const workType = task.workType as WorkTypeKey;
							const badge = WORK_TYPE_CONFIG[workType];

							return (
								<li key={task.id}>
									<button
										className="flex w-full items-center gap-3 rounded-control border border-transparent bg-surface-card-muted/60 px-3 py-3 text-left transition hover:border-border-subtle hover:bg-surface-card-muted"
										data-testid={`focus-ready-task-${task.id}`}
										onClick={() => onSelectTask(task)}
										type="button"
									>
										<span
											aria-hidden="true"
											className="h-4 w-4 shrink-0 rounded-full border-2 border-border-subtle"
										/>
										<span className="min-w-0 flex-1 truncate font-medium text-primary text-sm">
											{task.title}
										</span>
										<span
											className={`shrink-0 rounded-chip px-2 py-0.5 font-semibold text-xs ${badge.bg} ${badge.text}`}
										>
											{getWorkTypeLabel(workType, locale)}
										</span>
										{task.effortMinutes != null && (
											<span className="shrink-0 text-text-dimmed text-xs">
												{formatFocusMinutes(task.effortMinutes)}
											</span>
										)}
									</button>
								</li>
							);
						})}
					</ul>
					<div className="mt-4 text-center">
						<Link
							className="font-medium text-accent-cta text-sm hover:text-accent-cta-hover"
							data-testid="focus-ready-view-all-tasks"
							href="/tasks"
						>
							{t("viewAll")}
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
