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
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyActiveTasksGuide } from "~/app/_components/empty-active-tasks-guide";
import { PersonaPresetPicker } from "~/app/_components/persona-preset-picker";
import {
	TaskFieldsPanel,
	TITLE_FIELD_CLASS,
} from "~/app/_components/task-fields-panel";
import { usePresetCoachOnboarding } from "~/hooks/use-onboarding-state";
import { useTaskMutations } from "~/hooks/use-task-mutations";
import { formatEndedAgo } from "~/lib/catch-up/format-ended-ago";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import type {
	CommitmentHorizon,
	DomainTask,
	DomainTaskId,
} from "~/lib/data-mode/types";
import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";
import { PRESET_COACH_LINE } from "~/lib/onboarding/copy";
import type { TaskFootprint } from "~/lib/recap/types";
import {
	applyPersonaPresetToCreateState,
	DEFAULT_CREATE_FORM_ATTRIBUTES,
	getPersonaPresetLabel,
	getTaskBadgeDisplayMode,
	type PersonaPresetId,
} from "~/lib/task/persona-presets";
import { formatLocalDateKey } from "~/lib/time/local-date-key";

const AXIS_LABELS = { 1: "Light", 2: "Medium", 3: "Heavy" } as const;

function EisenhowerDetailBadges({
	workType,
	urgency,
	importance,
	commitmentHorizon,
}: {
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	commitmentHorizon: CommitmentHorizon;
}) {
	const config = WORK_TYPE_CONFIG[workType];
	return (
		<>
			<span
				className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
			>
				{config.label}
			</span>
			<span className="rounded-full bg-surface-panel px-2 py-0.5 font-medium text-text-secondary text-xs">
				U: {AXIS_LABELS[urgency]}
			</span>
			<span className="rounded-full bg-worktype-deep-bg px-2 py-0.5 font-medium text-worktype-deep-text text-xs">
				I: {AXIS_LABELS[importance]}
			</span>
			{commitmentHorizon === "ASAP" && (
				<span className="rounded-full bg-worktype-reactive-bg px-2 py-0.5 font-medium text-worktype-reactive-text text-xs">
					ASAP
				</span>
			)}
		</>
	);
}

function TaskBadges({
	personaPresetId,
	workType,
	urgency,
	importance,
	commitmentHorizon,
	effortMinutes,
	dimmed = false,
}: {
	personaPresetId: string | null;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	commitmentHorizon: CommitmentHorizon;
	effortMinutes: number | null;
	dimmed?: boolean;
}) {
	const dimClass = dimmed ? "opacity-60" : "";
	const displayMode = getTaskBadgeDisplayMode({
		personaPresetId,
		workType,
		urgency,
		importance,
		commitmentHorizon,
		effortMinutes,
	});

	if (displayMode === "legacy") {
		return (
			<span className={`flex min-w-0 flex-wrap items-center gap-1 ${dimClass}`}>
				<EisenhowerDetailBadges
					commitmentHorizon={commitmentHorizon}
					importance={importance}
					urgency={urgency}
					workType={workType}
				/>
			</span>
		);
	}

	if (displayMode === "persona") {
		const label = getPersonaPresetLabel(personaPresetId ?? "");
		const config = WORK_TYPE_CONFIG[workType];
		return (
			<span className={`flex min-w-0 flex-wrap items-center gap-1 ${dimClass}`}>
				<span
					className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
					data-testid="task-persona-badge"
				>
					{label}
				</span>
				{effortMinutes != null && (
					<span
						className="rounded-full bg-surface-panel px-2 py-0.5 font-medium text-text-secondary text-xs"
						data-testid="task-effort-badge"
					>
						{effortMinutes}m
					</span>
				)}
			</span>
		);
	}

	return (
		<span className={`flex min-w-0 flex-wrap items-center gap-1 ${dimClass}`}>
			<span
				className="rounded-full bg-surface-panel px-2 py-0.5 font-medium text-text-secondary text-xs"
				data-testid="task-custom-badge"
			>
				Custom
			</span>
			<EisenhowerDetailBadges
				commitmentHorizon={commitmentHorizon}
				importance={importance}
				urgency={urgency}
				workType={workType}
			/>
		</span>
	);
}

function parseEffortMinutes(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "") {
		return null;
	}
	const parsed = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(parsed) || parsed < 5 || parsed > 240) {
		return null;
	}
	return parsed;
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
	suggestionLoading?: boolean;
	footprints?: Record<string, TaskFootprint>;
};

type SortableActiveTaskRowProps = {
	task: DomainTask;
	dragDisabled: boolean;
	focusedTaskId: DomainTaskId | null;
	highlightedTaskId: DomainTaskId | null;
	continueTaskId: DomainTaskId | null;
	editingId: DomainTaskId | null;
	editTitle: string;
	editWorkType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	editUrgency: 1 | 2 | 3;
	editImportance: 1 | 2 | 3;
	editEffortMinutes: string;
	editCommitmentHorizon: CommitmentHorizon;
	editResumeNote: string;
	editIsDailyStanding: boolean;
	cycleLocked: boolean;
	markCompleteLocked: boolean;
	isMutating: boolean;
	canMidCycleMarkComplete: boolean;
	focusLocked: boolean;
	editPanelRef?: React.RefObject<HTMLDivElement | null>;
	onCommitEdit: () => void | Promise<void>;
	onStartEditing: (task: DomainTask) => void | Promise<void>;
	onSetEditingId: (id: DomainTaskId | null) => void;
	onSetEditTitle: (title: string) => void;
	onSetEditWorkType: (
		workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE",
	) => void;
	onSetEditUrgency: (urgency: 1 | 2 | 3) => void;
	onSetEditImportance: (importance: 1 | 2 | 3) => void;
	onSetEditEffortMinutes: (value: string) => void;
	onSetEditCommitmentHorizon: (value: CommitmentHorizon) => void;
	onSetEditResumeNote: (value: string) => void;
	onSetEditIsDailyStanding: (value: boolean) => void;
	onMidCycleMarkComplete?: (taskId: DomainTaskId, task: DomainTask) => void;
	onUpdateTask: (input: {
		id: DomainTaskId;
		status?: "completed";
	}) => Promise<void>;
	onFocusTask: (taskId: DomainTaskId, task: DomainTask) => void | Promise<void>;
	onDeleteTask: (input: { id: DomainTaskId }) => Promise<void>;
	onMarkDoneForToday: (taskId: DomainTaskId) => void;
	completingTaskId: DomainTaskId | null;
	onBeginComplete: (taskId: DomainTaskId) => void;
	footprints: Record<string, TaskFootprint>;
};

function SortableActiveTaskRow({
	task,
	dragDisabled,
	focusedTaskId,
	highlightedTaskId,
	continueTaskId,
	editingId,
	editTitle,
	editWorkType,
	editUrgency,
	editImportance,
	editEffortMinutes,
	editCommitmentHorizon,
	editResumeNote,
	editIsDailyStanding,
	cycleLocked,
	markCompleteLocked,
	isMutating,
	canMidCycleMarkComplete,
	focusLocked,
	editPanelRef,
	onCommitEdit,
	onStartEditing,
	onSetEditingId,
	onSetEditTitle,
	onSetEditWorkType,
	onSetEditUrgency,
	onSetEditImportance,
	onSetEditEffortMinutes,
	onSetEditCommitmentHorizon,
	onSetEditResumeNote,
	onSetEditIsDailyStanding,
	onMidCycleMarkComplete,
	onUpdateTask,
	onFocusTask,
	onDeleteTask,
	onMarkDoneForToday,
	completingTaskId,
	onBeginComplete,
	footprints,
}: SortableActiveTaskRowProps) {
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
	const showFootprint =
		footprint != null && (focusedTaskId === task.id || editingId === task.id);

	return (
		<li
			className={`flex max-w-full flex-col gap-2 overflow-hidden rounded-lg border border-transparent bg-surface-card px-4 py-3 ${
				focusedTaskId === task.id ? "ring-2 ring-focus" : ""
			} ${
				isHighlightedRow ? "ring-2 ring-accent-suggestion" : ""
			} ${isDragging ? "z-10 opacity-80" : ""} ${
				completingTaskId === task.id ? "animate-task-complete" : ""
			} ${task.doneForToday ? "opacity-60" : ""}`}
			data-testid={
				highlightedTaskId === task.id ? "suggested-task-row" : "active-task-row"
			}
			ref={setNodeRef}
			style={style}
		>
			<div className="flex w-full min-w-0 items-start gap-2">
				<button
					aria-label="Drag to reorder"
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
				{task.isDailyStanding ? (
					task.doneForToday ? (
						<span
							className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-accent-success bg-accent-success/20 text-accent-success text-xs"
							title="Done for today"
						>
							✓
						</span>
					) : (
						<button
							aria-label="Done for today"
							className="mt-0.5 shrink-0 rounded border border-border-subtle px-2 py-0.5 text-text-secondary text-xs transition hover:border-accent-success hover:text-accent-success disabled:cursor-not-allowed disabled:opacity-40"
							data-testid="done-for-today-button"
							disabled={markCompleteLocked || isMutating}
							onClick={() => onMarkDoneForToday(task.id)}
							type="button"
						>
							Done today
						</button>
					)
				) : (
					<button
						aria-label="Mark complete"
						className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-border-subtle transition hover:border-accent-success hover:bg-accent-success/20 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={markCompleteLocked || isMutating}
						onClick={() => {
							if (canMidCycleMarkComplete && onMidCycleMarkComplete != null) {
								onMidCycleMarkComplete(task.id, task);
								return;
							}

							onBeginComplete(task.id);
							void onUpdateTask({
								id: task.id,
								status: "completed",
							});
						}}
						type="button"
					/>
				)}
				{editingId === task.id ? (
					// biome-ignore lint/a11y/noStaticElementInteractions: focus-outside commit when leaving edit panel
					<div
						className="min-w-0 flex-1 space-y-2"
						onBlur={(event) => {
							const next = event.relatedTarget;
							if (next instanceof Node && event.currentTarget.contains(next)) {
								return;
							}
							void onCommitEdit();
						}}
						ref={editPanelRef}
					>
						<TaskFieldsPanel
							commitmentHorizon={editCommitmentHorizon}
							effortMinutes={editEffortMinutes}
							importance={editImportance}
							isDailyStanding={editIsDailyStanding}
							mode="edit"
							onCommitmentHorizonChange={onSetEditCommitmentHorizon}
							onEffortMinutesChange={onSetEditEffortMinutes}
							onImportanceChange={onSetEditImportance}
							onIsDailyStandingChange={onSetEditIsDailyStanding}
							onResumeNoteChange={onSetEditResumeNote}
							onTitleChange={onSetEditTitle}
							onTitleKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void onCommitEdit();
								}
								if (event.key === "Escape") onSetEditingId(null);
							}}
							onUrgencyChange={onSetEditUrgency}
							onWorkTypeChange={onSetEditWorkType}
							resumeNote={editResumeNote}
							resumeNoteFieldId={`task-resume-note-edit-${String(task.id)}`}
							title={editTitle}
							urgency={editUrgency}
							workType={editWorkType}
						/>
					</div>
				) : (
					<button
						aria-disabled={cycleLocked}
						className={`min-w-0 flex-1 basis-0 cursor-pointer overflow-hidden whitespace-pre-wrap break-all text-left text-primary ${
							cycleLocked ? "cursor-default" : ""
						} ${task.doneForToday ? "line-through opacity-70" : ""}`}
						onClick={() => {
							if (cycleLocked) return;
							void onStartEditing(task);
						}}
						type="button"
					>
						{task.title}
					</button>
				)}
			</div>
			{editingId !== task.id &&
				focusedTaskId === task.id &&
				!isContinueRow &&
				task.resumeNote != null &&
				task.resumeNote.length > 0 && (
					<p
						className="pl-9 text-sm text-text-dimmed italic"
						data-testid="task-resume-note"
					>
						{task.resumeNote}
					</p>
				)}
			{editingId !== task.id && isContinueRow && (
				<p
					className="flex items-center gap-1 pl-9 text-accent-suggestion text-sm"
					data-testid="continue-here-row"
				>
					<span aria-hidden="true">→</span>
					Continue here
				</p>
			)}
			{editingId !== task.id && (
				<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 pl-9">
					<span className="flex min-w-0 flex-wrap items-center gap-1">
						{task.isDailyStanding && (
							<span
								className="rounded-full bg-accent-suggestion/20 px-2 py-0.5 font-medium text-accent-suggestion text-xs"
								data-testid="daily-standing-badge"
							>
								Daily
							</span>
						)}
						<TaskBadges
							commitmentHorizon={task.commitmentHorizon}
							dimmed={task.doneForToday}
							effortMinutes={task.effortMinutes}
							importance={task.importance}
							personaPresetId={task.personaPresetId}
							urgency={task.urgency}
							workType={task.workType}
						/>
					</span>
					<div className="flex shrink-0 items-center gap-1">
						<button
							className={`rounded-lg px-2 py-1 font-medium text-xs transition ${
								focusedTaskId === task.id
									? "bg-accent-cta text-on-cta"
									: "bg-surface-panel text-text-section hover:bg-surface-card-muted"
							}`}
							disabled={focusLocked}
							onClick={() => void onFocusTask(task.id, task)}
							type="button"
						>
							{focusedTaskId === task.id ? "Focused" : "Focus"}
						</button>
						<button
							aria-label="Delete task"
							className="shrink-0 px-1 text-text-dimmed transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
							disabled={cycleLocked || isMutating}
							onClick={() => {
								void onDeleteTask({ id: task.id });
							}}
							type="button"
						>
							✕
						</button>
					</div>
				</div>
			)}
			{showFootprint && (
				<p
					className="pl-9 text-sm text-text-secondary"
					data-testid={`task-footprint-${task.id}`}
				>
					Last focused {formatEndedAgo(footprint.lastFocusedAt.getTime())} ·{" "}
					{footprint.cumulativeMinutes}m total
				</p>
			)}
		</li>
	);
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
	suggestionLoading = false,
	footprints = {},
}: TaskListProps) {
	const mode = useDataMode();
	const { shouldShowPresetCoach, markPresetCoachDismissed } =
		usePresetCoachOnboarding();
	const addTaskInputRef = useRef<HTMLInputElement>(null);
	const {
		createTask,
		updateTask,
		deleteTask,
		reorderTasks,
		markDoneForToday,
		isMutating,
		isCreating,
		error,
		clearError,
	} = useTaskMutations();

	const [newTitle, setNewTitle] = useState("");
	const [selectedPresetId, setSelectedPresetId] = useState<
		PersonaPresetId | "custom" | null
	>(null);
	const [showCustomPanel, setShowCustomPanel] = useState(false);
	const [newWorkType, setNewWorkType] = useState<
		"DEEP_WORK" | "OPERATIONAL" | "REACTIVE"
	>(DEFAULT_CREATE_FORM_ATTRIBUTES.workType);
	const [newUrgency, setNewUrgency] = useState<1 | 2 | 3>(
		DEFAULT_CREATE_FORM_ATTRIBUTES.urgency,
	);
	const [newImportance, setNewImportance] = useState<1 | 2 | 3>(
		DEFAULT_CREATE_FORM_ATTRIBUTES.importance,
	);
	const [newEffortMinutes, setNewEffortMinutes] = useState(
		DEFAULT_CREATE_FORM_ATTRIBUTES.effortMinutes,
	);
	const [newCommitmentHorizon, setNewCommitmentHorizon] =
		useState<CommitmentHorizon>(
			DEFAULT_CREATE_FORM_ATTRIBUTES.commitmentHorizon,
		);
	const [newIsDailyStanding, setNewIsDailyStanding] = useState(true);

	function resetCreateFormState() {
		setNewTitle("");
		setSelectedPresetId(null);
		setShowCustomPanel(false);
		setNewWorkType(DEFAULT_CREATE_FORM_ATTRIBUTES.workType);
		setNewUrgency(DEFAULT_CREATE_FORM_ATTRIBUTES.urgency);
		setNewImportance(DEFAULT_CREATE_FORM_ATTRIBUTES.importance);
		setNewEffortMinutes(DEFAULT_CREATE_FORM_ATTRIBUTES.effortMinutes);
		setNewCommitmentHorizon(DEFAULT_CREATE_FORM_ATTRIBUTES.commitmentHorizon);
		setNewIsDailyStanding(true);
	}

	function applyPresetToCreateForm(presetId: PersonaPresetId) {
		const applied = applyPersonaPresetToCreateState(presetId);
		setSelectedPresetId(presetId);
		setShowCustomPanel(false);
		setNewWorkType(applied.workType);
		setNewUrgency(applied.urgency);
		setNewImportance(applied.importance);
		setNewEffortMinutes(applied.effortMinutes);
		setNewCommitmentHorizon(applied.commitmentHorizon);
	}

	function markCreateFormCustom() {
		setSelectedPresetId("custom");
	}
	const [editingId, setEditingId] = useState<DomainTaskId | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editWorkType, setEditWorkType] = useState<
		"DEEP_WORK" | "OPERATIONAL" | "REACTIVE"
	>("OPERATIONAL");
	const [editUrgency, setEditUrgency] = useState<1 | 2 | 3>(2);
	const [editImportance, setEditImportance] = useState<1 | 2 | 3>(2);
	const [editEffortMinutes, setEditEffortMinutes] = useState("");
	const [editCommitmentHorizon, setEditCommitmentHorizon] =
		useState<CommitmentHorizon>("WHEN_POSSIBLE");
	const [editResumeNote, setEditResumeNote] = useState("");
	const [editIsDailyStanding, setEditIsDailyStanding] = useState(false);
	const [completingTaskId, setCompletingTaskId] = useState<DomainTaskId | null>(
		null,
	);

	function beginCompleteAnimation(taskId: DomainTaskId) {
		setCompletingTaskId(taskId);
		window.setTimeout(() => {
			setCompletingTaskId((current) => (current === taskId ? null : current));
		}, 400);
	}

	const activeTasks = tasks.filter((t) => t.status === "active");
	const completedTasks = tasks.filter((t) => t.status === "completed");
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
	const dragDisabled = cycleLocked || isMutating;

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

	const editPanelRef = useRef<HTMLDivElement | null>(null);
	const commitInFlightRef = useRef<Promise<void> | null>(null);

	const commitEditIfDirty = useCallback(async () => {
		if (commitInFlightRef.current) {
			await commitInFlightRef.current;
			return;
		}

		if (editingId == null) {
			return;
		}

		const run = async () => {
			if (!editTitle.trim()) {
				setEditingId(null);
				setEditTitle("");
				setEditResumeNote("");
				return;
			}

			await updateTask({
				id: editingId,
				title: editTitle.trim(),
				workType: editWorkType,
				urgency: editUrgency,
				weight: editUrgency,
				importance: editImportance,
				effortMinutes: parseEffortMinutes(editEffortMinutes),
				commitmentHorizon: editCommitmentHorizon,
				resumeNote:
					editResumeNote.trim().length > 0 ? editResumeNote.trim() : null,
				isDailyStanding: editIsDailyStanding,
			});
			setEditingId(null);
			setEditTitle("");
			setEditResumeNote("");
			setEditIsDailyStanding(false);
		};

		commitInFlightRef.current = run();
		try {
			await commitInFlightRef.current;
		} finally {
			commitInFlightRef.current = null;
		}
	}, [
		editingId,
		editTitle,
		editWorkType,
		editUrgency,
		editImportance,
		editEffortMinutes,
		editCommitmentHorizon,
		editResumeNote,
		editIsDailyStanding,
		updateTask,
	]);

	useEffect(() => {
		if (editingId == null) {
			return;
		}

		const handlePointerDown = (event: PointerEvent) => {
			const panel = editPanelRef.current;
			if (panel == null) {
				return;
			}
			if (event.target instanceof Node && panel.contains(event.target)) {
				return;
			}
			void commitEditIfDirty();
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
		};
	}, [editingId, commitEditIfDirty]);

	async function startEditing(task: DomainTask) {
		if (editingId != null) {
			await commitEditIfDirty();
		}
		setEditingId(task.id);
		setEditTitle(task.title);
		setEditWorkType(task.workType);
		setEditUrgency(task.urgency);
		setEditImportance(task.importance);
		setEditEffortMinutes(
			task.effortMinutes != null ? String(task.effortMinutes) : "",
		);
		setEditCommitmentHorizon(task.commitmentHorizon);
		setEditResumeNote(task.resumeNote ?? "");
		setEditIsDailyStanding(task.isDailyStanding);
	}

	const localDateKey = formatLocalDateKey();

	const handleMarkDoneForToday = useCallback(
		(taskId: DomainTaskId) => {
			void markDoneForToday({ id: taskId, localDateKey });
		},
		[localDateKey, markDoneForToday],
	);

	const handleFocusTask = useCallback(
		async (taskId: DomainTaskId, task: DomainTask) => {
			if (editingId != null) {
				await commitEditIfDirty();
			}
			onFocusTask(taskId, task);
		},
		[commitEditIfDirty, editingId, onFocusTask],
	);

	return (
		<div className="w-full max-w-lg space-y-6" data-testid="task-list">
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
						Dismiss
					</button>
				</div>
			)}

			<form
				className="space-y-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (!newTitle.trim()) {
						return;
					}

					void (async () => {
						await createTask({
							title: newTitle.trim(),
							workType: newWorkType,
							urgency: newUrgency,
							weight: newUrgency,
							importance: newImportance,
							effortMinutes: parseEffortMinutes(newEffortMinutes),
							commitmentHorizon: newCommitmentHorizon,
							personaPresetId:
								selectedPresetId === "custom"
									? "custom"
									: selectedPresetId != null
										? selectedPresetId
										: null,
							isDailyStanding: newIsDailyStanding,
						});
						resetCreateFormState();
					})();
				}}
			>
				<div className="flex gap-2">
					<input
						className={`flex-1 ${TITLE_FIELD_CLASS}`}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder="Add a new task..."
						ref={addTaskInputRef}
						type="text"
						value={newTitle}
					/>
					<button
						className="rounded-lg bg-accent-cta px-4 py-2 font-medium text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50"
						disabled={isCreating || !newTitle.trim()}
						type="submit"
					>
						{isCreating ? "Adding..." : "Add"}
					</button>
				</div>
				<TaskFieldsPanel
					commitmentHorizon={newCommitmentHorizon}
					effortMinutes={newEffortMinutes}
					importance={newImportance}
					includeTitle={false}
					isDailyStanding={newIsDailyStanding}
					mode="create"
					onCommitmentHorizonChange={(value) => {
						markCreateFormCustom();
						setNewCommitmentHorizon(value);
					}}
					onEffortMinutesChange={setNewEffortMinutes}
					onImportanceChange={(value) => {
						markCreateFormCustom();
						setNewImportance(value);
					}}
					onIsDailyStandingChange={setNewIsDailyStanding}
					onTitleChange={setNewTitle}
					onUrgencyChange={(value) => {
						markCreateFormCustom();
						setNewUrgency(value);
					}}
					onWorkTypeChange={(value) => {
						markCreateFormCustom();
						setNewWorkType(value);
					}}
					personaPresetPicker={
						<PersonaPresetPicker
							coachLine={shouldShowPresetCoach ? PRESET_COACH_LINE : undefined}
							onDismissCoach={
								shouldShowPresetCoach ? markPresetCoachDismissed : undefined
							}
							onSelectCustom={() => {
								setShowCustomPanel(true);
								markCreateFormCustom();
							}}
							onSelectPreset={applyPresetToCreateForm}
							selectedPresetId={selectedPresetId}
							showCustomPanel={showCustomPanel}
						/>
					}
					presetEffortField={
						selectedPresetId != null && selectedPresetId !== "custom" ? (
							<div className="flex flex-wrap items-center gap-2">
								<span className="w-16 shrink-0 text-text-secondary text-xs">
									Effort
								</span>
								<input
									className="w-24 rounded-md bg-surface-panel px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
									data-testid="create-preset-effort"
									inputMode="numeric"
									max={240}
									min={5}
									onChange={(e) => setNewEffortMinutes(e.target.value)}
									placeholder="min"
									type="number"
									value={newEffortMinutes}
								/>
								{newEffortMinutes !== "" && (
									<button
										className="text-text-dimmed text-xs hover:text-text-section"
										onClick={() => setNewEffortMinutes("")}
										type="button"
									>
										Clear
									</button>
								)}
							</div>
						) : null
					}
					showAttributeFields={showCustomPanel}
					title={newTitle}
					urgency={newUrgency}
					workType={newWorkType}
				/>
			</form>

			<section>
				<h2 className="mb-2 font-semibold text-lg text-text-section">
					Active ({activeTasks.length})
				</h2>
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
							<ul className="space-y-2">
								{activeTasks.map((task) => (
									<SortableActiveTaskRow
										canMidCycleMarkComplete={canMidCycleMarkComplete}
										completingTaskId={completingTaskId}
										continueTaskId={continueTaskId}
										cycleLocked={cycleLocked}
										dragDisabled={dragDisabled}
										editCommitmentHorizon={editCommitmentHorizon}
										editEffortMinutes={editEffortMinutes}
										editImportance={editImportance}
										editIsDailyStanding={editIsDailyStanding}
										editingId={editingId}
										editPanelRef={
											editingId === task.id ? editPanelRef : undefined
										}
										editResumeNote={editResumeNote}
										editTitle={editTitle}
										editUrgency={editUrgency}
										editWorkType={editWorkType}
										focusedTaskId={focusedTaskId}
										focusLocked={focusLocked}
										footprints={footprints}
										highlightedTaskId={highlightedTaskId}
										isMutating={isMutating}
										key={String(task.id)}
										markCompleteLocked={markCompleteLocked}
										onBeginComplete={beginCompleteAnimation}
										onCommitEdit={commitEditIfDirty}
										onDeleteTask={deleteTask}
										onFocusTask={handleFocusTask}
										onMarkDoneForToday={handleMarkDoneForToday}
										onMidCycleMarkComplete={onMidCycleMarkComplete}
										onSetEditCommitmentHorizon={setEditCommitmentHorizon}
										onSetEditEffortMinutes={setEditEffortMinutes}
										onSetEditImportance={setEditImportance}
										onSetEditIsDailyStanding={setEditIsDailyStanding}
										onSetEditingId={setEditingId}
										onSetEditResumeNote={setEditResumeNote}
										onSetEditTitle={setEditTitle}
										onSetEditUrgency={setEditUrgency}
										onSetEditWorkType={setEditWorkType}
										onStartEditing={startEditing}
										onUpdateTask={updateTask}
										task={task}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				)}
			</section>

			{completedTasks.length > 0 && (
				<section>
					<h2 className="mb-2 font-semibold text-lg text-text-section">
						Completed ({completedTasks.length})
					</h2>
					<ul className="space-y-2">
						{completedTasks.map((task) => (
							<li
								className="flex max-w-full flex-col gap-2 overflow-hidden rounded-lg border border-transparent bg-surface-card-muted px-4 py-3"
								key={String(task.id)}
							>
								<div className="flex w-full min-w-0 items-start gap-2">
									<button
										aria-label="Revert to active"
										className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-accent-success bg-accent-success/30 transition hover:border-border-subtle hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
										disabled={cycleLocked || isMutating}
										onClick={() => {
											void updateTask({
												id: task.id,
												status: "active",
											});
										}}
										type="button"
									/>
									<span className="min-w-0 flex-1 basis-0 overflow-hidden whitespace-pre-wrap break-all text-text-secondary line-through">
										{task.title}
									</span>
								</div>
								<div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 pl-7">
									<TaskBadges
										commitmentHorizon={task.commitmentHorizon}
										dimmed
										effortMinutes={task.effortMinutes}
										importance={task.importance}
										personaPresetId={task.personaPresetId}
										urgency={task.urgency}
										workType={task.workType}
									/>
									<button
										aria-label="Delete task"
										className="shrink-0 px-1 text-text-dimmed transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
										disabled={cycleLocked || isMutating}
										onClick={() => {
											void deleteTask({ id: task.id });
										}}
										type="button"
									>
										✕
									</button>
								</div>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
