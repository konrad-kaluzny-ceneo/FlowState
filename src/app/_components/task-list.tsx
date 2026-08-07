"use client";

import {
	DndContext,
	type DragEndEvent,
	MouseSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Ban,
	CheckCircle,
	MoreHorizontal,
	Plus,
	Settings2,
	Target,
	Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { AddTaskModal } from "~/app/_components/add-task-modal";
import { EmptyActiveTasksGuide } from "~/app/_components/empty-active-tasks-guide";
import { TaskDetailPanel } from "~/app/_components/task-detail-panel";
import { Select } from "~/app/_components/ui/select";
import { TabPanel, Tabs } from "~/app/_components/ui/tabs";
import { useTaskMutations } from "~/hooks/use-task-mutations";
import { formatEndedAgo } from "~/lib/catch-up/format-ended-ago";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import type { DomainTask, DomainTaskId } from "~/lib/data-mode/types";
import { CalmGardenSprig } from "~/lib/design/illustrations/calm-garden-sprig";
import {
	getWorkTypeLabel,
	WORK_TYPE_CONFIG,
} from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import type { TaskFootprint } from "~/lib/recap/types";

type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
type TabValue = "active" | "planned" | "completed" | "blocked" | "delegated";
type TypeFilterValue = "all" | WorkType;
type SortValue = "manual" | "priority" | "effort";

function TaskBadges({
	workType,
	effortMinutes,
	dimmed = false,
	locale,
	t,
}: {
	workType: WorkType;
	effortMinutes: number | null;
	dimmed?: boolean;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Tasks">>;
}) {
	const config = WORK_TYPE_CONFIG[workType];
	const dimClass = dimmed ? "opacity-60" : "";
	return (
		<span className={`flex flex-wrap items-center gap-1.5 ${dimClass}`}>
			<span
				className={`rounded-full px-2.5 py-1 font-semibold text-xs ring-1 ${config.bg} ${config.text} ${config.badgeRing}`}
				data-testid="task-type-badge"
			>
				{getWorkTypeLabel(workType, locale)}
			</span>
			{effortMinutes != null && (
				<span
					className="rounded-full border border-border-subtle bg-surface-panel px-2.5 py-1 font-medium text-text-secondary text-xs"
					data-testid="task-effort-badge"
				>
					{t("effortMinutes", { minutes: effortMinutes })}
				</span>
			)}
		</span>
	);
}

type TaskListProps = {
	tasks: DomainTask[];
	onRefresh: () => Promise<void>;
	focusedTaskId: DomainTaskId | null;
	highlightedTaskId?: DomainTaskId | null;
	continueTaskId?: DomainTaskId | null;
	onFocusTask: (taskId: DomainTaskId, task: DomainTask) => void;
	cycleState: "idle" | "running" | "paused" | "completed";
	cycleKind?: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	onMidCycleMarkComplete?: (taskId: DomainTaskId, task: DomainTask) => void;
	onMidCycleBlock?: (taskId: DomainTaskId, task: DomainTask) => void;
	suggestionLoading?: boolean;
	footprints?: Record<string, TaskFootprint>;
	chromeSubdued?: boolean;
	focusShellActive?: boolean;
	onOpenArchive?: () => void;
};

type TaskRowProps = {
	task: DomainTask;
	focusedTaskId: DomainTaskId | null;
	highlightedTaskId?: DomainTaskId | null;
	continueTaskId: DomainTaskId | null;
	markCompleteLocked: boolean;
	isMutating: boolean;
	canMidCycleMarkComplete: boolean;
	canMidCycleBlock: boolean;
	focusLocked: boolean;
	cycleLocked: boolean;
	completingTaskId: DomainTaskId | null;
	onBeginComplete: (taskId: DomainTaskId) => void;
	onMidCycleMarkComplete?: (taskId: DomainTaskId, task: DomainTask) => void;
	onMidCycleBlock?: (taskId: DomainTaskId, task: DomainTask) => void;
	onUpdateTask: ReturnType<typeof useTaskMutations>["updateTask"];
	onFocusTask: (taskId: DomainTaskId, task: DomainTask) => void | Promise<void>;
	onDeleteTask: ReturnType<typeof useTaskMutations>["deleteTask"];
	onOpenDetail: (task: DomainTask) => void;
	footprints: Record<string, TaskFootprint>;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Tasks">>;
};

function TaskFocusButton({
	task,
	focusedTaskId,
	focusLocked,
	onFocusTask,
	t,
}: {
	task: DomainTask;
	focusedTaskId: DomainTaskId | null;
	focusLocked: boolean;
	onFocusTask: TaskRowProps["onFocusTask"];
	t: ReturnType<typeof useTranslations<"Tasks">>;
}) {
	const isFocused = focusedTaskId === task.id;
	return (
		<button
			aria-label={isFocused ? t("focusedAria") : t("focusAria")}
			aria-pressed={isFocused}
			className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40 ${
				isFocused
					? "border-accent-cta/40 bg-accent-cta text-on-cta"
					: "border-border-subtle bg-surface-panel text-text-section hover:bg-surface-card-muted"
			}`}
			data-testid="task-focus-button"
			disabled={focusLocked}
			onClick={() => void onFocusTask(task.id, task)}
			type="button"
		>
			<Target aria-hidden="true" className="h-4 w-4" />
			<span className="font-semibold text-xs">{t("focusLabel")}</span>
		</button>
	);
}

function TaskRowMoreMenu({
	task,
	focusedTaskId,
	markCompleteLocked,
	isMutating,
	canMidCycleMarkComplete,
	canMidCycleBlock,
	cycleLocked,
	onBeginComplete,
	onMidCycleMarkComplete,
	onMidCycleBlock,
	onUpdateTask,
	onDeleteTask,
	t,
}: {
	task: DomainTask;
	focusedTaskId: DomainTaskId | null;
	markCompleteLocked: boolean;
	isMutating: boolean;
	canMidCycleMarkComplete: boolean;
	canMidCycleBlock: boolean;
	cycleLocked: boolean;
	onBeginComplete: (taskId: DomainTaskId) => void;
	onMidCycleMarkComplete?: (taskId: DomainTaskId, task: DomainTask) => void;
	onMidCycleBlock?: (taskId: DomainTaskId, task: DomainTask) => void;
	onUpdateTask: TaskRowProps["onUpdateTask"];
	onDeleteTask: TaskRowProps["onDeleteTask"];
	t: ReturnType<typeof useTranslations<"Tasks">>;
}) {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const isFocusedTask = task.id === focusedTaskId;
	const blockViasMidCycle = canMidCycleBlock && isFocusedTask;
	const completeViaMidCycle =
		canMidCycleMarkComplete && isFocusedTask && onMidCycleMarkComplete != null;

	useEffect(() => {
		if (!open) {
			return;
		}
		const onPointerDown = (event: PointerEvent) => {
			if (
				menuRef.current != null &&
				!menuRef.current.contains(event.target as Node)
			) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	const menuItemClass =
		"flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-primary transition hover:bg-surface-card-muted disabled:cursor-not-allowed disabled:opacity-40";

	return (
		<div className="relative shrink-0" ref={menuRef}>
			<button
				aria-expanded={open}
				aria-haspopup="true"
				aria-label={t("moreActionsAria")}
				className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-panel px-2.5 py-1 text-text-section transition hover:bg-surface-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
				data-testid="task-more-actions"
				onClick={() => setOpen((prev) => !prev)}
				ref={triggerRef}
				type="button"
			>
				<MoreHorizontal aria-hidden="true" className="h-4 w-4" />
				<span className="font-semibold text-xs">{t("moreActionsLabel")}</span>
			</button>
			{open ? (
				<div
					className="absolute top-full right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-card-border bg-surface-card p-1 shadow-md"
					data-testid="task-more-menu"
				>
					<button
						aria-label={t("markCompleteAria")}
						className={menuItemClass}
						data-testid="task-complete-button"
						disabled={markCompleteLocked || isMutating}
						onClick={() => {
							setOpen(false);
							if (completeViaMidCycle && onMidCycleMarkComplete != null) {
								onMidCycleMarkComplete(task.id, task);
								return;
							}
							onBeginComplete(task.id);
							void onUpdateTask({ id: task.id, status: "completed" });
						}}
						type="button"
					>
						<CheckCircle
							aria-hidden="true"
							className="h-4 w-4 text-accent-success"
						/>
						<span className="font-semibold text-xs">
							{t("markCompleteLabel")}
						</span>
					</button>
					<button
						aria-label={t("blockAria")}
						className={menuItemClass}
						data-testid="task-block-button"
						disabled={
							blockViasMidCycle ? isMutating : cycleLocked || isMutating
						}
						onClick={() => {
							setOpen(false);
							if (blockViasMidCycle && onMidCycleBlock != null) {
								onMidCycleBlock(task.id, task);
								return;
							}
							void onUpdateTask({ id: task.id, status: "blocked" });
						}}
						type="button"
					>
						<Ban aria-hidden="true" className="h-4 w-4 text-amber-400" />
						<span className="font-semibold text-xs">{t("blockLabel")}</span>
					</button>
					<button
						aria-label={t("deleteAria")}
						className={menuItemClass}
						data-testid="task-delete-button"
						disabled={cycleLocked || isMutating}
						onClick={() => {
							setOpen(false);
							void onDeleteTask({ id: task.id });
						}}
						type="button"
					>
						<Trash2 aria-hidden="true" className="h-4 w-4 text-red-400" />
						<span className="font-semibold text-xs">{t("deleteLabel")}</span>
					</button>
				</div>
			) : null}
		</div>
	);
}

function TaskRowBadgesRow({
	task,
	locale,
	t,
	padClass,
	dimmed = false,
}: {
	task: DomainTask;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Tasks">>;
	padClass: string;
	dimmed?: boolean;
}) {
	return (
		<div
			className={`flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 ${padClass}`}
		>
			<TaskBadges
				dimmed={dimmed}
				effortMinutes={task.effortMinutes}
				locale={locale}
				t={t}
				workType={task.workType}
			/>
		</div>
	);
}

const taskRowCardClass =
	"flex max-w-full flex-col gap-2.5 rounded-card border border-card-border bg-surface-card px-5 py-4 shadow-sm has-[[data-testid=task-more-menu]]:relative has-[[data-testid=task-more-menu]]:z-30";

function SortableTaskRow({
	task,
	dragDisabled,
	focusedTaskId,
	highlightedTaskId = null,
	continueTaskId,
	markCompleteLocked,
	isMutating,
	canMidCycleMarkComplete,
	canMidCycleBlock,
	focusLocked,
	cycleLocked,
	completingTaskId,
	onBeginComplete,
	onMidCycleMarkComplete,
	onMidCycleBlock,
	onUpdateTask,
	onFocusTask,
	onDeleteTask,
	onOpenDetail,
	footprints,
	locale,
	t,
}: TaskRowProps & { dragDisabled: boolean }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: String(task.id),
		disabled: dragDisabled,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const isContinueRow = continueTaskId === task.id;
	const isHighlightedRow = highlightedTaskId === task.id || isContinueRow;
	const footprint = footprints[String(task.id)];
	const showFootprint = footprint != null && focusedTaskId === task.id;

	return (
		<li
			className={`${taskRowCardClass} ${
				focusedTaskId === task.id ? "ring-2 ring-focus" : ""
			} ${isHighlightedRow ? "ring-2 ring-accent-suggestion" : ""} ${
				isDragging ? "z-10 opacity-80" : ""
			} ${completingTaskId === task.id ? "animate-task-complete" : ""} ${
				task.doneForToday ? "opacity-60" : ""
			}`}
			data-testid={
				highlightedTaskId === task.id ? "suggested-task-row" : "active-task-row"
			}
			ref={setNodeRef}
			style={style}
		>
			<div className="flex w-full min-w-0 items-start gap-2">
				<button
					aria-label={t("dragHandleAria")}
					className={`mt-0.5 shrink-0 cursor-grab px-1 text-text-dimmed transition hover:text-text-secondary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 ${
						dragDisabled ? "pointer-events-none" : ""
					}`}
					data-testid="task-drag-handle"
					disabled={dragDisabled}
					ref={setActivatorNodeRef}
					type="button"
					{...attributes}
					{...listeners}
				>
					⋮⋮
				</button>
				<TaskFocusButton
					focusedTaskId={focusedTaskId}
					focusLocked={focusLocked}
					onFocusTask={onFocusTask}
					t={t}
					task={task}
				/>
				<button
					aria-disabled={cycleLocked}
					className={`min-w-0 flex-1 basis-0 cursor-pointer overflow-hidden whitespace-pre-wrap break-all text-left font-medium text-base leading-snug ${
						cycleLocked ? "cursor-default" : ""
					} ${task.doneForToday ? "text-text-dimmed" : "text-primary"}`}
					onClick={() => {
						if (cycleLocked) return;
						onOpenDetail(task);
					}}
					type="button"
				>
					{task.title}
				</button>
				<TaskRowMoreMenu
					canMidCycleBlock={canMidCycleBlock}
					canMidCycleMarkComplete={canMidCycleMarkComplete}
					cycleLocked={cycleLocked}
					focusedTaskId={focusedTaskId}
					isMutating={isMutating}
					markCompleteLocked={markCompleteLocked}
					onBeginComplete={onBeginComplete}
					onDeleteTask={onDeleteTask}
					onMidCycleBlock={onMidCycleBlock}
					onMidCycleMarkComplete={onMidCycleMarkComplete}
					onUpdateTask={onUpdateTask}
					t={t}
					task={task}
				/>
			</div>
			{isContinueRow && (
				<p
					className="flex items-center gap-1 text-accent-suggestion text-sm"
					data-testid="continue-here-row"
				>
					<span aria-hidden="true">→</span>
					{t("continueHere")}
				</p>
			)}
			<TaskRowBadgesRow locale={locale} padClass="" t={t} task={task} />
			{showFootprint && (
				<p
					className="text-sm text-text-secondary"
					data-testid={`task-footprint-${task.id}`}
				>
					{t("footprint", {
						ago: formatEndedAgo(
							footprint.lastFocusedAt.getTime(),
							Date.now(),
							locale,
						),
						minutes: footprint.cumulativeMinutes,
					})}
				</p>
			)}
		</li>
	);
}

function StaticTaskRow({
	task,
	testId,
	focusedTaskId,
	continueTaskId,
	markCompleteLocked,
	isMutating,
	canMidCycleMarkComplete,
	canMidCycleBlock,
	focusLocked,
	cycleLocked,
	completingTaskId,
	onBeginComplete,
	onMidCycleMarkComplete,
	onMidCycleBlock,
	onUpdateTask,
	onFocusTask,
	onDeleteTask,
	onOpenDetail,
	footprints,
	locale,
	t,
	dimmed = false,
	blocked = false,
	delegated = false,
}: TaskRowProps & {
	testId: string;
	dimmed?: boolean;
	blocked?: boolean;
	delegated?: boolean;
}) {
	const isContinueRow = continueTaskId === task.id;
	const footprint = footprints[String(task.id)];
	const showFootprint = footprint != null && focusedTaskId === task.id;

	return (
		<li
			className={`${taskRowCardClass} ${
				dimmed ? "bg-surface-card-muted/80" : ""
			} ${blocked ? "bg-surface-card-muted/60 opacity-80" : ""} ${delegated ? "bg-surface-card-muted/60 opacity-80" : ""} ${focusedTaskId === task.id ? "ring-2 ring-focus" : ""} ${
				isContinueRow ? "ring-2 ring-accent-suggestion" : ""
			} ${completingTaskId === task.id ? "animate-task-complete" : ""}`}
			data-testid={testId}
		>
			<div className="flex w-full min-w-0 items-start gap-2">
				{blocked ? (
					<button
						aria-label={t("unblockAria")}
						className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-amber-400 bg-amber-400/30 transition hover:border-border-subtle hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
						data-testid="task-unblock-button"
						disabled={cycleLocked || isMutating}
						onClick={() => {
							void onUpdateTask({ id: task.id, status: "active" });
						}}
						type="button"
					/>
				) : delegated ? (
					<button
						aria-label={t("undelegateAria")}
						className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-sky-400 bg-sky-400/30 transition hover:border-border-subtle hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
						data-testid="task-undelegate-button"
						disabled={cycleLocked || isMutating}
						onClick={() => {
							void onUpdateTask({ id: task.id, status: "active" });
						}}
						type="button"
					/>
				) : dimmed ? (
					<button
						aria-label={t("revertAria")}
						className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-accent-success bg-accent-success/30 transition hover:border-border-subtle hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
						disabled={cycleLocked || isMutating}
						onClick={() => {
							void onUpdateTask({ id: task.id, status: "active" });
						}}
						type="button"
					/>
				) : (
					<TaskFocusButton
						focusedTaskId={focusedTaskId}
						focusLocked={focusLocked}
						onFocusTask={onFocusTask}
						t={t}
						task={task}
					/>
				)}
				<button
					className={`min-w-0 flex-1 basis-0 cursor-pointer overflow-hidden whitespace-pre-wrap break-all text-left font-medium text-base leading-snug ${
						dimmed ? "text-text-dimmed" : "text-primary"
					}`}
					onClick={() => onOpenDetail(task)}
					type="button"
				>
					{task.title}
				</button>
				{!dimmed && !blocked && !delegated ? (
					<TaskRowMoreMenu
						canMidCycleBlock={canMidCycleBlock}
						canMidCycleMarkComplete={canMidCycleMarkComplete}
						cycleLocked={cycleLocked}
						focusedTaskId={focusedTaskId}
						isMutating={isMutating}
						markCompleteLocked={markCompleteLocked}
						onBeginComplete={onBeginComplete}
						onDeleteTask={onDeleteTask}
						onMidCycleBlock={onMidCycleBlock}
						onMidCycleMarkComplete={onMidCycleMarkComplete}
						onUpdateTask={onUpdateTask}
						t={t}
						task={task}
					/>
				) : (
					<button
						aria-label={t("deleteAria")}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-surface-panel px-2.5 py-1 text-text-section transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
						data-testid="task-delete-button"
						disabled={cycleLocked || isMutating}
						onClick={() => {
							void onDeleteTask({ id: task.id });
						}}
						type="button"
					>
						<Trash2 aria-hidden="true" className="h-4 w-4" />
						<span className="font-semibold text-xs">{t("deleteLabel")}</span>
					</button>
				)}
			</div>
			{isContinueRow && (
				<p
					className="flex items-center gap-1 text-accent-suggestion text-sm"
					data-testid="continue-here-row"
				>
					<span aria-hidden="true">→</span>
					{t("continueHere")}
				</p>
			)}
			<TaskRowBadgesRow
				dimmed={dimmed}
				locale={locale}
				padClass=""
				t={t}
				task={task}
			/>
			{showFootprint && (
				<p
					className="text-sm text-text-secondary"
					data-testid={`task-footprint-${task.id}`}
				>
					{t("footprint", {
						ago: formatEndedAgo(
							footprint.lastFocusedAt.getTime(),
							Date.now(),
							locale,
						),
						minutes: footprint.cumulativeMinutes,
					})}
				</p>
			)}
		</li>
	);
}

function applyFilterAndSort(
	list: DomainTask[],
	typeFilter: TypeFilterValue,
	sortKey: SortValue,
): DomainTask[] {
	const filtered =
		typeFilter === "all"
			? list
			: list.filter((task) => task.workType === typeFilter);

	if (sortKey === "manual") {
		return filtered;
	}

	const sorted = [...filtered];
	if (sortKey === "priority") {
		sorted.sort((a, b) => b.urgency - a.urgency);
	} else if (sortKey === "effort") {
		sorted.sort(
			(a, b) =>
				(a.effortMinutes ?? Number.POSITIVE_INFINITY) -
				(b.effortMinutes ?? Number.POSITIVE_INFINITY),
		);
	}
	return sorted;
}

export function TaskList({
	tasks,
	onRefresh: _onRefresh,
	focusedTaskId,
	highlightedTaskId = null,
	continueTaskId = null,
	onFocusTask,
	cycleState,
	cycleKind = null,
	onMidCycleMarkComplete,
	onMidCycleBlock,
	suggestionLoading = false,
	footprints = {},
	chromeSubdued = false,
	focusShellActive = false,
	onOpenArchive,
}: TaskListProps) {
	const locale = useLocale() as UserLocale;
	const t = useTranslations("Tasks");
	const mode = useDataMode();
	const addTaskInputRef = useRef<HTMLInputElement>(null);
	const {
		createTask,
		updateTask,
		deleteTask,
		reorderTasks,
		isMutating,
		isCreating,
		error,
		clearError,
	} = useTaskMutations();

	const [quickTitle, setQuickTitle] = useState("");
	const [activeTab, setActiveTab] = useState<TabValue>("active");
	const [typeFilter, setTypeFilter] = useState<TypeFilterValue>("all");
	const [sortKey, setSortKey] = useState<SortValue>("manual");
	const [showAddModal, setShowAddModal] = useState(false);
	const [addModalInitialTitle, setAddModalInitialTitle] = useState("");
	const [detailTaskId, setDetailTaskId] = useState<DomainTaskId | null>(null);
	const [completingTaskId, setCompletingTaskId] = useState<DomainTaskId | null>(
		null,
	);

	function beginCompleteAnimation(taskId: DomainTaskId) {
		setCompletingTaskId(taskId);
		window.setTimeout(() => {
			setCompletingTaskId((current) => (current === taskId ? null : current));
		}, 400);
	}

	const activeTasksAll = tasks.filter((task) => task.status === "active");
	const plannedTasksAll = tasks.filter((task) => task.status === "planned");
	const completedTasksAll = tasks.filter((task) => task.status === "completed");
	const blockedTasksAll = tasks.filter((task) => task.status === "blocked");
	const delegatedTasksAll = tasks.filter((task) => task.status === "delegated");

	const isManualView = typeFilter === "all" && sortKey === "manual";
	const activeTasks = applyFilterAndSort(activeTasksAll, typeFilter, sortKey);
	const plannedTasks = applyFilterAndSort(plannedTasksAll, typeFilter, sortKey);
	const completedTasks = applyFilterAndSort(
		completedTasksAll,
		typeFilter,
		sortKey,
	);
	const blockedTasks = applyFilterAndSort(blockedTasksAll, typeFilter, sortKey);
	const delegatedTasks = applyFilterAndSort(
		delegatedTasksAll,
		typeFilter,
		sortKey,
	);

	const projectSuggestions = useMemo(() => {
		const values = new Set<string>();
		for (const task of tasks) {
			if (task.project != null && task.project.trim().length > 0) {
				values.add(task.project);
			}
		}
		return Array.from(values).sort((a, b) => a.localeCompare(b));
	}, [tasks]);

	const cycleLocked =
		cycleState === "running" ||
		cycleState === "paused" ||
		cycleState === "completed";
	const isBreakCycle =
		cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
	const focusLocked =
		((cycleState === "running" || cycleState === "paused") &&
			cycleKind === "WORK") ||
		cycleState === "completed" ||
		(isBreakCycle && suggestionLoading);
	const markCompleteLocked =
		cycleState === "completed" ||
		isBreakCycle ||
		((cycleState === "running" || cycleState === "paused") &&
			cycleKind !== "WORK");
	const canMidCycleMarkComplete =
		(cycleState === "running" || cycleState === "paused") &&
		cycleKind === "WORK" &&
		onMidCycleMarkComplete != null;
	const canMidCycleBlock =
		(cycleState === "running" || cycleState === "paused") &&
		cycleKind === "WORK" &&
		onMidCycleBlock != null;
	const dragDisabled = cycleLocked || isMutating || !isManualView;

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
		useSensor(MouseSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (over == null || active.id === over.id) {
			return;
		}

		const oldIndex = activeTasks.findIndex(
			(task) => String(task.id) === active.id,
		);
		const newIndex = activeTasks.findIndex(
			(task) => String(task.id) === over.id,
		);
		if (oldIndex === -1 || newIndex === -1) {
			return;
		}

		const reordered = arrayMove(activeTasks, oldIndex, newIndex);
		void reorderTasks({
			orderedIds: reordered.map((task) => task.id),
		});
	}

	const detailTask =
		detailTaskId != null
			? (tasks.find((task) => task.id === detailTaskId) ?? null)
			: null;

	const focusChromeSubduedClass = focusShellActive
		? "opacity-60 saturate-75 transition-opacity duration-300 motion-reduce:transition-none"
		: "";

	const tabItems = [
		{
			value: "active",
			label: t("sectionActive", { count: activeTasksAll.length }),
		},
		{
			value: "planned",
			label: t("sectionPlanned", { count: plannedTasksAll.length }),
		},
		{
			value: "completed",
			label: t("sectionCompleted", { count: completedTasksAll.length }),
		},
		{
			value: "blocked",
			label: t("sectionBlocked", { count: blockedTasksAll.length }),
		},
		{
			value: "delegated",
			label: t("sectionDelegated", { count: delegatedTasksAll.length }),
		},
	];

	const typeFilterOptions = [
		{ value: "all" as const, label: t("filterAllTypes") },
		{ value: "DEEP_WORK" as const, label: t("workType.DEEP_WORK") },
		{ value: "OPERATIONAL" as const, label: t("workType.OPERATIONAL") },
		{ value: "REACTIVE" as const, label: t("workType.REACTIVE") },
	];

	const sortOptions = [
		{ value: "manual" as const, label: t("sortManual") },
		{ value: "priority" as const, label: t("sortPriority") },
		{ value: "effort" as const, label: t("sortEffort") },
	];

	const rowSharedProps = {
		focusedTaskId,
		highlightedTaskId,
		continueTaskId,
		markCompleteLocked,
		isMutating,
		canMidCycleMarkComplete,
		canMidCycleBlock,
		focusLocked,
		cycleLocked,
		completingTaskId,
		onBeginComplete: beginCompleteAnimation,
		onMidCycleMarkComplete,
		onMidCycleBlock,
		onUpdateTask: updateTask,
		onFocusTask,
		onDeleteTask: deleteTask,
		onOpenDetail: (task: DomainTask) => setDetailTaskId(task.id),
		footprints,
		locale,
		t,
	};

	return (
		<div
			className={
				chromeSubdued
					? "w-full space-y-section opacity-80 saturate-75"
					: "w-full space-y-section"
			}
			data-break-chrome-subdued={chromeSubdued ? "true" : undefined}
			data-testid="task-list"
		>
			{error != null && (
				<div
					className="rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-3 text-red-100 text-sm"
					data-testid="task-list-error"
					role="alert"
				>
					{error}
					<button
						className="ml-3 underline hover:text-primary"
						onClick={clearError}
						type="button"
					>
						{t("errorDismiss")}
					</button>
				</div>
			)}

			<div
				className={`rounded-card border border-card-border bg-surface-card shadow-sm${focusChromeSubduedClass ? ` ${focusChromeSubduedClass}` : ""}`}
				data-focus-chrome-subdued={focusShellActive ? "true" : undefined}
			>
				<form
					className="flex flex-wrap items-center gap-2 px-4 py-3 sm:flex-nowrap"
					onSubmit={(e) => {
						e.preventDefault();
						if (!quickTitle.trim()) {
							return;
						}
						void (async () => {
							await createTask({
								title: quickTitle.trim(),
								isDailyStanding: false,
							});
							setQuickTitle("");
						})();
					}}
				>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
						<input
							className="w-full min-w-0 flex-1 border-0 bg-transparent py-1 text-primary placeholder:text-text-dimmed focus:outline-none"
							onChange={(e) => setQuickTitle(e.target.value)}
							placeholder={t("inlineAddPlaceholder")}
							ref={addTaskInputRef}
							type="text"
							value={quickTitle}
						/>
						<span className="text-text-dimmed text-xs">
							{t("inlineAddHint")}
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<button
							aria-busy={isCreating}
							aria-label={t("createAddAria")}
							className="rounded-control bg-accent-cta p-2 font-medium text-on-cta transition hover:bg-accent-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
							disabled={isCreating || !quickTitle.trim()}
							type="submit"
						>
							<Plus aria-hidden="true" className="h-5 w-5" />
						</button>
						<button
							aria-label={t("addTaskButton")}
							className="rounded-control bg-surface-panel p-2 text-text-section transition hover:bg-surface-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
							data-testid="open-add-task-modal"
							onClick={() => {
								setAddModalInitialTitle(quickTitle);
								setQuickTitle("");
								setShowAddModal(true);
							}}
							type="button"
						>
							<Settings2 aria-hidden="true" className="h-5 w-5" />
						</button>
					</div>
				</form>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-border-subtle border-b pb-4">
				<Tabs
					aria-label={t("tabsAriaLabel")}
					id="zadania-tabs"
					items={tabItems}
					onChange={(value) => setActiveTab(value as TabValue)}
					value={activeTab}
				/>
				<div className="flex items-center gap-2">
					<Select
						aria-label={t("filterTypeAria")}
						onChange={(value) => setTypeFilter(value as TypeFilterValue)}
						options={typeFilterOptions}
						value={typeFilter}
					/>
					<Select
						aria-label={t("sortAria")}
						onChange={(value) => setSortKey(value as SortValue)}
						options={sortOptions}
						value={sortKey}
					/>
				</div>
			</div>

			<TabPanel activeValue={activeTab} tabsId="zadania-tabs" value="active">
				{activeTasks.length === 0 ? (
					<EmptyActiveTasksGuide
						mode={mode}
						onAddTaskClick={() => addTaskInputRef.current?.focus()}
					/>
				) : (
					<DndContext onDragEnd={handleDragEnd} sensors={sensors}>
						<SortableContext
							items={activeTasks.map((task) => String(task.id))}
							strategy={verticalListSortingStrategy}
						>
							<ul className="space-y-3">
								{activeTasks.map((task) => (
									<SortableTaskRow
										{...rowSharedProps}
										dragDisabled={dragDisabled}
										key={String(task.id)}
										task={task}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				)}
			</TabPanel>

			<TabPanel activeValue={activeTab} tabsId="zadania-tabs" value="planned">
				{plannedTasks.length === 0 ? (
					<p className="text-sm text-text-secondary">{t("plannedEmpty")}</p>
				) : (
					<ul className="space-y-3">
						{plannedTasks.map((task) => (
							<StaticTaskRow
								{...rowSharedProps}
								key={String(task.id)}
								task={task}
								testId="planned-task-row"
							/>
						))}
					</ul>
				)}
			</TabPanel>

			<TabPanel activeValue={activeTab} tabsId="zadania-tabs" value="completed">
				{completedTasks.length === 0 ? (
					<p className="text-sm text-text-secondary">{t("completedEmpty")}</p>
				) : (
					<ul className="space-y-3">
						{completedTasks.map((task) => (
							<StaticTaskRow
								{...rowSharedProps}
								dimmed
								key={String(task.id)}
								task={task}
								testId="completed-task-row"
							/>
						))}
					</ul>
				)}
			</TabPanel>

			<TabPanel activeValue={activeTab} tabsId="zadania-tabs" value="blocked">
				{blockedTasks.length === 0 ? (
					<p className="text-sm text-text-secondary">{t("blockedEmpty")}</p>
				) : (
					<ul className="space-y-3">
						{blockedTasks.map((task) => (
							<StaticTaskRow
								{...rowSharedProps}
								blocked
								key={String(task.id)}
								task={task}
								testId="blocked-task-row"
							/>
						))}
					</ul>
				)}
			</TabPanel>

			<TabPanel activeValue={activeTab} tabsId="zadania-tabs" value="delegated">
				{delegatedTasks.length === 0 ? (
					<p className="text-sm text-text-secondary">{t("delegatedEmpty")}</p>
				) : (
					<ul className="space-y-3">
						{delegatedTasks.map((task) => (
							<StaticTaskRow
								{...rowSharedProps}
								delegated
								key={String(task.id)}
								task={task}
								testId="delegated-task-row"
							/>
						))}
					</ul>
				)}
			</TabPanel>

			{onOpenArchive != null && (
				<div
					className={focusChromeSubduedClass || undefined}
					data-focus-chrome-subdued={focusShellActive ? "true" : undefined}
				>
					<button
						className="text-sm text-text-secondary underline-offset-2 transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
						data-testid="task-archive-entry"
						onClick={onOpenArchive}
						type="button"
					>
						{t("archiveEntry")}
					</button>
				</div>
			)}

			<aside
				className="flex items-start gap-3 rounded-card border border-card-border bg-surface-panel/70 px-5 py-4 shadow-sm"
				data-testid="tasks-footer-tip"
			>
				<CalmGardenSprig
					className="h-10 w-10 shrink-0 text-accent-break"
					variant="idle"
				/>
				<div>
					<p className="font-semibold text-sm text-text-section">
						{t("footerTipHeading")}
					</p>
					<p className="mt-1 text-sm text-text-secondary leading-relaxed">
						{t("footerTipBody")}
					</p>
				</div>
			</aside>

			{showAddModal && (
				<AddTaskModal
					initialTitle={addModalInitialTitle}
					isCreating={isCreating}
					onClose={() => setShowAddModal(false)}
					onCreate={async (input) => {
						await createTask(input);
					}}
					projectSuggestions={projectSuggestions}
				/>
			)}

			{detailTask != null && (
				<TaskDetailPanel
					cycleLocked={cycleLocked}
					onClose={() => setDetailTaskId(null)}
					onCommit={async (input) => {
						await updateTask(input);
					}}
					onStartFocus={onFocusTask}
					projectSuggestions={projectSuggestions}
					task={detailTask}
				/>
			)}
		</div>
	);
}
