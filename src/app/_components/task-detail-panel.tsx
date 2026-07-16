"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
	ModalShell,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { TaskFieldsPanel } from "~/app/_components/task-fields-panel";
import type {
	CommitmentHorizon,
	DomainTask,
	DomainTaskId,
} from "~/lib/data-mode/types";

export type TaskDetailCommitInput = {
	id: DomainTaskId;
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	resumeNote: string | null;
	project: string | null;
	isDailyStanding: boolean;
};

type TaskDetailPanelProps = {
	task: DomainTask;
	cycleLocked: boolean;
	projectSuggestions: string[];
	onClose: () => void;
	onCommit: (input: TaskDetailCommitInput) => Promise<void> | void;
	onStartFocus: (taskId: DomainTaskId, task: DomainTask) => void;
};

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

export function TaskDetailPanel({
	task,
	cycleLocked,
	projectSuggestions,
	onClose,
	onCommit,
	onStartFocus,
}: TaskDetailPanelProps) {
	const t = useTranslations("Tasks");
	const [title, setTitle] = useState(task.title);
	const [workType, setWorkType] = useState(task.workType);
	const [urgency, setUrgency] = useState(task.urgency);
	const [importance, setImportance] = useState(task.importance);
	const [effortMinutes, setEffortMinutes] = useState(
		task.effortMinutes != null ? String(task.effortMinutes) : "",
	);
	const [commitmentHorizon, setCommitmentHorizon] = useState(
		task.commitmentHorizon,
	);
	const [resumeNote, setResumeNote] = useState(task.resumeNote ?? "");
	const [isDailyStanding, setIsDailyStanding] = useState(task.isDailyStanding);
	const [project, setProject] = useState(task.project ?? "");

	useEffect(() => {
		setTitle(task.title);
		setWorkType(task.workType);
		setUrgency(task.urgency);
		setImportance(task.importance);
		setEffortMinutes(
			task.effortMinutes != null ? String(task.effortMinutes) : "",
		);
		setCommitmentHorizon(task.commitmentHorizon);
		setResumeNote(task.resumeNote ?? "");
		setIsDailyStanding(task.isDailyStanding);
		setProject(task.project ?? "");
	}, [task]);

	function commitIfDirty() {
		if (!title.trim()) {
			return;
		}
		const nextResumeNote =
			resumeNote.trim().length > 0 ? resumeNote.trim() : null;
		const nextProject = project.trim().length > 0 ? project.trim() : null;
		const nextEffortMinutes = parseEffortMinutes(effortMinutes);
		const isDirty =
			title.trim() !== task.title ||
			workType !== task.workType ||
			urgency !== task.urgency ||
			importance !== task.importance ||
			nextEffortMinutes !== task.effortMinutes ||
			commitmentHorizon !== task.commitmentHorizon ||
			nextResumeNote !== task.resumeNote ||
			nextProject !== task.project ||
			isDailyStanding !== task.isDailyStanding;

		if (!isDirty) {
			return;
		}

		void onCommit({
			id: task.id,
			title: title.trim(),
			workType,
			urgency,
			importance,
			effortMinutes: nextEffortMinutes,
			commitmentHorizon,
			resumeNote: nextResumeNote,
			project: nextProject,
			isDailyStanding,
		});
	}

	function handleClose() {
		commitIfDirty();
		onClose();
	}

	const statusLabel =
		task.status === "active"
			? t("statusActive")
			: task.status === "planned"
				? t("statusPlanned")
				: task.status === "completed"
					? t("statusCompleted")
					: task.status === "blocked"
						? t("statusBlocked")
						: t("statusArchived");

	return (
		<ModalShell
			maxWidth="lg"
			onEscape={handleClose}
			testId="task-detail-panel"
			title={
				<span className="flex items-center gap-2">
					<span
						className="rounded-full bg-surface-panel px-2 py-0.5 font-medium text-text-secondary text-xs"
						data-testid="task-detail-status-pill"
					>
						{statusLabel}
					</span>
					{t("detailTitle")}
				</span>
			}
			titleId="task-detail-panel-title"
		>
			<TaskFieldsPanel
				commitmentHorizon={commitmentHorizon}
				dailyStandingFieldId={`daily-standing-detail-${String(task.id)}`}
				effortMinutes={effortMinutes}
				importance={importance}
				isDailyStanding={isDailyStanding}
				mode="edit"
				onCommitmentHorizonChange={setCommitmentHorizon}
				onEffortMinutesChange={setEffortMinutes}
				onImportanceChange={setImportance}
				onIsDailyStandingChange={setIsDailyStanding}
				onProjectChange={setProject}
				onResumeNoteChange={setResumeNote}
				onTitleChange={setTitle}
				onUrgencyChange={setUrgency}
				onWorkTypeChange={setWorkType}
				project={project}
				projectFieldId={`task-detail-project-${String(task.id)}`}
				projectSuggestions={projectSuggestions}
				resumeNote={resumeNote}
				resumeNoteFieldId={`task-detail-resume-note-${String(task.id)}`}
				title={title}
				urgency={urgency}
				workType={workType}
			/>
			<div className="mt-4 flex flex-col gap-2">
				<button
					className={overlayButtonClass.primaryFull}
					data-testid="task-detail-start"
					disabled={cycleLocked}
					onClick={() => {
						commitIfDirty();
						onStartFocus(task.id, task);
						onClose();
					}}
					type="button"
				>
					{t("startWorkingOn")}
				</button>
				<button
					className={overlayButtonClass.secondaryFull}
					onClick={handleClose}
					type="button"
				>
					{t("detailClose")}
				</button>
			</div>
		</ModalShell>
	);
}
