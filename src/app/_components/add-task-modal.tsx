"use client";

import { useTranslations } from "next-intl";
import type { FormEvent } from "react";
import { useState } from "react";

import {
	ModalShell,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { PersonaPresetPicker } from "~/app/_components/persona-preset-picker";
import { TaskFieldsPanel } from "~/app/_components/task-fields-panel";
import type { CommitmentHorizon } from "~/lib/data-mode/types";
import {
	applyPersonaPresetToCreateState,
	DEFAULT_CREATE_FORM_ATTRIBUTES,
	type PersonaPresetId,
} from "~/lib/task/persona-presets";

export type AddTaskModalCreateInput = {
	title: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: number | null;
	commitmentHorizon: CommitmentHorizon;
	project: string | null;
	personaPresetId: string | null;
	isDailyStanding: boolean;
};

type AddTaskModalProps = {
	onClose: () => void;
	onCreate: (input: AddTaskModalCreateInput) => Promise<void> | void;
	isCreating?: boolean;
	projectSuggestions?: string[];
	initialTitle?: string;
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

export function AddTaskModal({
	onClose,
	onCreate,
	isCreating = false,
	projectSuggestions = [],
	initialTitle = "",
}: AddTaskModalProps) {
	const t = useTranslations("Tasks");
	const [title, setTitle] = useState(initialTitle);
	const [selectedPresetId, setSelectedPresetId] = useState<
		PersonaPresetId | "custom" | null
	>(null);
	const [showCustomPanel, setShowCustomPanel] = useState(false);
	const [workType, setWorkType] = useState(
		DEFAULT_CREATE_FORM_ATTRIBUTES.workType,
	);
	const [urgency, setUrgency] = useState(
		DEFAULT_CREATE_FORM_ATTRIBUTES.urgency,
	);
	const [importance, setImportance] = useState(
		DEFAULT_CREATE_FORM_ATTRIBUTES.importance,
	);
	const [effortMinutes, setEffortMinutes] = useState(
		DEFAULT_CREATE_FORM_ATTRIBUTES.effortMinutes,
	);
	const [commitmentHorizon, setCommitmentHorizon] = useState<CommitmentHorizon>(
		DEFAULT_CREATE_FORM_ATTRIBUTES.commitmentHorizon,
	);
	const [isDailyStanding, setIsDailyStanding] = useState(false);
	const [project, setProject] = useState("");

	function markCustom() {
		setSelectedPresetId("custom");
	}

	function applyPreset(presetId: PersonaPresetId) {
		const applied = applyPersonaPresetToCreateState(presetId);
		setSelectedPresetId(presetId);
		setShowCustomPanel(false);
		setWorkType(applied.workType);
		setUrgency(applied.urgency);
		setImportance(applied.importance);
		setEffortMinutes(applied.effortMinutes);
		setCommitmentHorizon(applied.commitmentHorizon);
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!title.trim()) {
			return;
		}
		await onCreate({
			title: title.trim(),
			workType,
			urgency,
			importance,
			effortMinutes: parseEffortMinutes(effortMinutes),
			commitmentHorizon,
			project: project.trim().length > 0 ? project.trim() : null,
			personaPresetId:
				selectedPresetId === "custom" ? "custom" : selectedPresetId,
			isDailyStanding,
		});
		onClose();
	}

	return (
		<ModalShell
			maxWidth="lg"
			onEscape={onClose}
			testId="add-task-modal"
			title={t("addTaskModalTitle")}
			titleId="add-task-modal-title"
		>
			<form className="space-y-3" onSubmit={handleSubmit}>
				<TaskFieldsPanel
					commitmentHorizon={commitmentHorizon}
					dailyStandingFieldId="daily-standing-add-modal"
					effortMinutes={effortMinutes}
					importance={importance}
					includeTitle
					isDailyStanding={isDailyStanding}
					mode="create"
					onCommitmentHorizonChange={(value) => {
						markCustom();
						setCommitmentHorizon(value);
					}}
					onEffortMinutesChange={setEffortMinutes}
					onImportanceChange={(value) => {
						markCustom();
						setImportance(value);
					}}
					onIsDailyStandingChange={setIsDailyStanding}
					onProjectChange={setProject}
					onTitleChange={setTitle}
					onUrgencyChange={(value) => {
						markCustom();
						setUrgency(value);
					}}
					onWorkTypeChange={(value) => {
						markCustom();
						setWorkType(value);
					}}
					personaPresetPicker={
						<PersonaPresetPicker
							onSelectCustom={() => {
								setShowCustomPanel(true);
								markCustom();
							}}
							onSelectPreset={applyPreset}
							selectedPresetId={selectedPresetId}
							showCustomPanel={showCustomPanel}
						/>
					}
					project={project}
					projectFieldId="add-task-modal-project"
					projectSuggestions={projectSuggestions}
					showAttributeFields={showCustomPanel}
					title={title}
					urgency={urgency}
					workType={workType}
				/>
				<div className="flex gap-3">
					<button
						className={overlayButtonClass.secondaryFull}
						onClick={onClose}
						type="button"
					>
						{t("addTaskModalCancel")}
					</button>
					<button
						className={overlayButtonClass.primaryFull}
						disabled={isCreating || !title.trim()}
						type="submit"
					>
						{t("addTaskModalSubmit")}
					</button>
				</div>
			</form>
		</ModalShell>
	);
}
