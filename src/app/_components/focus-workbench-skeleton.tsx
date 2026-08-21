"use client";

import { Target } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { FocusEmptyState } from "~/app/_components/focus-empty-state";
import { FocusGettingStarted } from "~/app/_components/focus-getting-started";
import { FocusInfoBanner } from "~/app/_components/focus-info-banner";
import {
	FocusReadyKickoffPending,
	FocusReadyState,
} from "~/app/_components/focus-ready-state";
import { FocusTodayPanel } from "~/app/_components/focus-today-panel";
import type { DomainTask } from "~/lib/data-mode/types";

/**
 * Calm-landing placeholder for /focus while tasks suspend or guest storage
 * hydrates. Hero matches the most common settled auth view (kickoff); only
 * dynamic slots (task title / rows, day-summary values) pulse.
 */
export function FocusWorkbenchSkeleton() {
	const tHome = useTranslations("Home");
	const tReady = useTranslations("FocusReady");

	return (
		<div
			aria-busy="true"
			aria-live="polite"
			className="flex w-full flex-col gap-6"
			data-testid="dashboard-loading"
		>
			<span className="sr-only">{tHome("dashboardLoading")}</span>
			<div
				className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-8"
				data-testid="home-workbench-grid"
			>
				<div className="order-1 flex flex-col gap-section">
					<div
						className="focus-ready-hero w-full overflow-hidden rounded-card border border-card-border bg-surface-card shadow-sm"
						data-testid="focus-ready-skeleton"
					>
						<div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
							<FocusReadyKickoffPending />
						</div>

						<div className="border-border-subtle border-t px-6 py-5">
							<p className="mb-3 font-medium text-text-section text-xs">
								{tReady("suggestedHeading")}
							</p>
							<ul className="space-y-2">
								<FocusTaskRowSkeleton titleClassName="w-[55%]" />
								<FocusTaskRowSkeleton titleClassName="w-[42%]" />
								<FocusTaskRowSkeleton titleClassName="w-[68%]" />
							</ul>
							<div className="mt-4 text-center">
								<Link
									aria-hidden="true"
									className="pointer-events-none font-medium text-accent-cta text-sm"
									href="/tasks"
									tabIndex={-1}
								>
									{tReady("viewAll")}
								</Link>
							</div>
						</div>
					</div>
					<FocusInfoBanner variant="ready" />
				</div>

				<div
					className="order-2 flex w-full flex-col gap-4 max-lg:order-3"
					data-testid="home-context-rail"
				>
					<FocusTodayPanel
						summary={{
							budgetMinutes: null,
							forceShow: true,
							hasBudget: false,
							isLoading: true,
							remainingMinutes: null,
							sessionsCompleted: 0,
							tasksDone: 0,
							tasksTotal: 0,
							usedMinutes: 0,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * Active-cycle recovery gate when tasks are already known. Renders the real
 * calm-landing chrome; only day-summary values stay pulsed until the hook settles.
 */
export function FocusWorkbenchPending({
	tasks,
	onAddTask,
	onSelectTask,
	kickoffPending = false,
}: {
	tasks: DomainTask[];
	onAddTask: () => void;
	onSelectTask: (task: DomainTask) => void;
	/** Prefer kickoff-shaped hero (auth + suggestion gate). */
	kickoffPending?: boolean;
}) {
	const tHome = useTranslations("Home");
	const hasFocusableTasks = tasks.some(
		(task) => task.status === "active" || task.status === "planned",
	);

	return (
		<div
			aria-busy="true"
			aria-live="polite"
			className="flex w-full flex-col gap-6"
			data-testid="dashboard-loading"
		>
			<span className="sr-only">{tHome("dashboardLoading")}</span>
			<div
				className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-8"
				data-testid="home-workbench-grid"
			>
				<div className="order-1 flex flex-col gap-section">
					{hasFocusableTasks ? (
						<>
							<FocusReadyState
								kickoffPending={kickoffPending}
								onAddTask={onAddTask}
								onSelectTask={onSelectTask}
								tasks={tasks}
							/>
							<FocusInfoBanner variant="ready" />
						</>
					) : (
						<>
							<FocusEmptyState onAddTask={onAddTask} />
							<FocusInfoBanner variant="empty" />
							<FocusGettingStarted onAddTask={onAddTask} />
						</>
					)}
				</div>

				<div
					className="order-2 flex w-full flex-col gap-4 max-lg:order-3"
					data-testid="home-context-rail"
				>
					<FocusTodayPanel
						onAddTask={onAddTask}
						summary={{
							budgetMinutes: null,
							forceShow: true,
							hasBudget: false,
							isLoading: false,
							remainingMinutes: null,
							sessionsCompleted: 0,
							tasksDone: 0,
							tasksTotal: 0,
							usedMinutes: 0,
						}}
					/>
				</div>
			</div>
		</div>
	);
}

function FocusTaskRowSkeleton({ titleClassName }: { titleClassName: string }) {
	return (
		<li className="flex items-stretch gap-1">
			<div className="flex min-w-0 flex-1 items-center gap-3 rounded-control border border-transparent bg-surface-card-muted/60 px-3 py-3">
				<Target
					aria-hidden="true"
					className="h-4 w-4 shrink-0 text-text-dimmed"
				/>
				<span
					aria-hidden="true"
					className={`h-4 animate-pulse rounded bg-surface-panel ${titleClassName}`}
				/>
				<span
					aria-hidden="true"
					className="h-5 w-16 shrink-0 animate-pulse rounded-chip bg-surface-panel"
				/>
				<span
					aria-hidden="true"
					className="h-4 w-8 shrink-0 animate-pulse rounded bg-surface-panel"
				/>
			</div>
		</li>
	);
}
