"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { DurationPicker } from "~/app/_components/duration-picker";
import { OverlayScrim } from "~/app/_components/overlay-shell";
import {
	TaskSuggestionCard,
	type TaskSuggestionData,
} from "~/app/_components/task-suggestion-card";
import type { DomainTask, DomainTaskStatus } from "~/lib/data-mode/types";
import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";
import {
	getWorkTypeLabel,
	WORK_TYPE_CONFIG,
	type WorkTypeKey,
} from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getMaxWorkDurationSec,
	getMinWorkDurationSec,
	getWorkDurationPresets,
} from "~/lib/duration-bounds";
import { isDurationSecInRange } from "~/lib/duration-input";
import { getLastDuration } from "~/lib/duration-storage";
import { formatFocusMinutes } from "~/lib/time/format-focus-minutes";

type FocusKickoffTask = {
	id: string | number;
	title: string;
};

type FocusSuggestionPopup = {
	suggestion: TaskSuggestionData;
	coachLine?: string;
	onAccept: () => void;
	isAccepting?: boolean;
};

type FocusReadyStateProps = {
	tasks: DomainTask[];
	onAddTask: () => void;
	onSelectTask: (task: DomainTask) => void;
	kickoffTask?: FocusKickoffTask | null;
	preferredWorkDurationSec?: number | null;
	onWorkDurationManualChange?: () => void;
	onStartKickoff?: (durationSec: number) => Promise<void>;
	isStartingKickoff?: boolean;
	autoSuggestedTaskId?: string | number | null;
	suggestionPopup?: FocusSuggestionPopup | null;
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

function domainTaskIdsMatch(
	left: string | number,
	right: string | number,
): boolean {
	return String(left) === String(right);
}

function rankFocusReadyTasks(tasks: DomainTask[]): DomainTask[] {
	return tasks
		.filter((task) => FOCUS_READY_STATUSES.has(task.status))
		.sort((a, b) => {
			const rankDiff =
				focusReadyStatusRank(a.status) - focusReadyStatusRank(b.status);
			if (rankDiff !== 0) {
				return rankDiff;
			}
			return a.sortOrder - b.sortOrder;
		});
}

export function selectFocusReadyTasks(
	tasks: DomainTask[],
	pinTaskId?: string | number | null,
): DomainTask[] {
	const ranked = rankFocusReadyTasks(tasks);
	const base = ranked.slice(0, 3);
	if (pinTaskId == null) {
		return base;
	}
	if (base.some((task) => domainTaskIdsMatch(task.id, pinTaskId))) {
		return base;
	}
	const pinned = ranked.find((task) => domainTaskIdsMatch(task.id, pinTaskId));
	if (pinned == null) {
		return base;
	}
	return [pinned, ...base].slice(0, 3);
}

function FocusReadySuggestionStar({
	ariaLabel,
	onClick,
	testId,
}: {
	ariaLabel: string;
	onClick: () => void;
	testId: string;
}) {
	return (
		<button
			aria-label={ariaLabel}
			className="flex shrink-0 items-center justify-center rounded-control border border-accent-cta/25 bg-accent-cta/10 px-2.5 text-accent-cta transition hover:border-accent-cta/40 hover:bg-accent-cta/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
			data-testid={testId}
			onClick={onClick}
			type="button"
		>
			<Star aria-hidden="true" className="h-4 w-4 fill-current" />
		</button>
	);
}

function FocusReadyKickoffHeader({
	task,
	preferredWorkDurationSec,
	onWorkDurationManualChange,
	onStart,
	isStarting = false,
	showSuggestionStar = false,
	suggestionStarAria,
	onSuggestionStarClick,
}: {
	task: FocusKickoffTask;
	preferredWorkDurationSec?: number | null;
	onWorkDurationManualChange?: () => void;
	onStart: (durationSec: number) => Promise<void>;
	isStarting?: boolean;
	showSuggestionStar?: boolean;
	suggestionStarAria?: string;
	onSuggestionStarClick?: () => void;
}) {
	const t = useTranslations("Timer");
	const [workDurationSec, setWorkDurationSec] = useState(
		() => preferredWorkDurationSec ?? getLastDuration(),
	);
	const [workPickerInvalid, setWorkPickerInvalid] = useState(false);

	useEffect(() => {
		if (preferredWorkDurationSec != null) {
			setWorkDurationSec(preferredWorkDurationSec);
		}
	}, [preferredWorkDurationSec]);

	const workMinSec = getMinWorkDurationSec();
	const workMaxSec = getMaxWorkDurationSec();
	const workValid = isDurationSecInRange(
		workDurationSec,
		workMinSec,
		workMaxSec,
	);

	return (
		<div
			className="flex w-full flex-col items-center gap-4 text-center"
			data-testid="focus-ready-kickoff"
		>
			<p className="font-semibold text-sm text-text-section">
				{t("idleReadyToFocusOn")}
			</p>
			<div className="flex max-w-full items-center justify-center gap-2">
				<p className="font-semibold text-primary text-xl">{task.title}</p>
				{showSuggestionStar &&
				suggestionStarAria != null &&
				onSuggestionStarClick != null ? (
					<FocusReadySuggestionStar
						ariaLabel={suggestionStarAria}
						onClick={onSuggestionStarClick}
						testId="focus-ready-kickoff-suggestion-star"
					/>
				) : null}
			</div>

			<div className="w-full">
				<p className="text-center text-sm text-text-secondary">
					{t("idleWorkDuration")}
				</p>
				<DurationPicker
					boundsLabel={t("boundsWork")}
					maxSec={workMaxSec}
					minSec={workMinSec}
					onChangeSec={(sec) => {
						onWorkDurationManualChange?.();
						setWorkDurationSec(sec);
					}}
					onValidationChange={setWorkPickerInvalid}
					presets={getWorkDurationPresets()}
					testIdPrefix="work-duration"
					valueSec={workDurationSec}
				/>
			</div>

			<button
				aria-label={t("startCycleForTask", { title: task.title })}
				className="w-full rounded-control bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50"
				data-testid="timer-start-cycle"
				disabled={isStarting || workPickerInvalid || !workValid}
				onClick={() => void onStart(workDurationSec)}
				type="button"
			>
				<span aria-hidden="true">
					{isStarting ? t("starting") : t("startLabel")}
				</span>
			</button>
		</div>
	);
}

export function FocusReadyState({
	tasks,
	onAddTask,
	onSelectTask,
	kickoffTask = null,
	preferredWorkDurationSec,
	onWorkDurationManualChange,
	onStartKickoff,
	isStartingKickoff = false,
	autoSuggestedTaskId = null,
	suggestionPopup = null,
}: FocusReadyStateProps) {
	const t = useTranslations("FocusReady");
	const locale = useLocale() as UserLocale;
	const suggestedTasks = selectFocusReadyTasks(tasks, autoSuggestedTaskId);
	const showKickoff = kickoffTask != null && onStartKickoff != null;
	const [suggestionOpen, setSuggestionOpen] = useState(false);
	const hasSuggestionPopup = suggestionPopup != null;

	const isAutoSuggestedTask = (taskId: string | number) =>
		autoSuggestedTaskId != null &&
		hasSuggestionPopup &&
		domainTaskIdsMatch(autoSuggestedTaskId, taskId);

	const openSuggestionPopup = () => setSuggestionOpen(true);
	const kickoffShowsSuggestionStar =
		showKickoff && kickoffTask != null && isAutoSuggestedTask(kickoffTask.id);

	return (
		<>
			<div
				className="focus-ready-hero w-full overflow-hidden rounded-card border border-card-border bg-surface-card shadow-sm"
				data-testid="focus-ready-state"
			>
				<div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
					{showKickoff ? (
						<FocusReadyKickoffHeader
							isStarting={isStartingKickoff}
							onStart={onStartKickoff}
							onSuggestionStarClick={openSuggestionPopup}
							onWorkDurationManualChange={onWorkDurationManualChange}
							preferredWorkDurationSec={preferredWorkDurationSec}
							showSuggestionStar={kickoffShowsSuggestionStar}
							suggestionStarAria={t("suggestionStarAria")}
							task={kickoffTask}
						/>
					) : (
						<>
							<div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-cta/10">
								<CalmGardenSprig className="h-8 w-8" variant="work" />
							</div>
							<div>
								<h2 className="font-semibold text-primary text-xl">
									{t("heading")}
								</h2>
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
						</>
					)}
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
								const isSelected =
									kickoffTask != null &&
									domainTaskIdsMatch(kickoffTask.id, task.id);
								const showSuggestionStar = isAutoSuggestedTask(task.id);

								return (
									<li className="flex items-stretch gap-1" key={task.id}>
										<button
											aria-pressed={isSelected}
											className={`flex min-w-0 flex-1 items-center gap-3 rounded-control border px-3 py-3 text-left transition ${
												isSelected
													? "border-accent-cta/40 bg-accent-cta/5"
													: "border-transparent bg-surface-card-muted/60 hover:border-border-subtle hover:bg-surface-card-muted"
											}`}
											data-testid={`focus-ready-task-${task.id}`}
											onClick={() => onSelectTask(task)}
											type="button"
										>
											<span
												aria-hidden="true"
												className={`h-4 w-4 shrink-0 rounded-full border-2 ${
													isSelected
														? "border-accent-cta bg-accent-cta"
														: "border-border-subtle"
												}`}
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
										{showSuggestionStar ? (
											<FocusReadySuggestionStar
												ariaLabel={t("suggestionStarAria")}
												onClick={openSuggestionPopup}
												testId={`focus-ready-suggestion-star-${task.id}`}
											/>
										) : null}
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

			{suggestionOpen && suggestionPopup != null && (
				<OverlayScrim
					ariaLabelledBy="task-suggestion-heading"
					onEscape={() => setSuggestionOpen(false)}
					role="dialog"
					testId="focus-suggestion-popup"
					zIndex={58}
				>
					<TaskSuggestionCard
						coachLine={suggestionPopup.coachLine}
						isAccepting={suggestionPopup.isAccepting}
						onAccept={() => {
							suggestionPopup.onAccept();
							setSuggestionOpen(false);
						}}
						status="ready"
						suggestion={suggestionPopup.suggestion}
					/>
				</OverlayScrim>
			)}
		</>
	);
}
