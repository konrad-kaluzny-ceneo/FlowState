"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, ReactNode } from "react";

import { StyledCheckbox } from "~/app/_components/styled-checkbox";
import { SegmentedControl } from "~/app/_components/ui/segmented-control";
import type { CommitmentHorizon } from "~/lib/data-mode/types";
import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";

const HORIZON_VALUES: CommitmentHorizon[] = [
	"ASAP",
	"THIS_WEEK",
	"WHEN_POSSIBLE",
];

const TITLE_FIELD_CLASS =
	"w-full rounded-lg border border-border-subtle bg-surface-card px-4 py-2 text-primary placeholder:text-text-dimmed focus:border-text-secondary focus:outline-none";

type EisenhowerAttributeFieldsProps = {
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: string;
	commitmentHorizon: CommitmentHorizon;
	onUrgencyChange: (value: 1 | 2 | 3) => void;
	onImportanceChange: (value: 1 | 2 | 3) => void;
	onEffortMinutesChange: (value: string) => void;
	onCommitmentHorizonChange: (value: CommitmentHorizon) => void;
};

function EisenhowerAttributeFields({
	urgency,
	importance,
	effortMinutes,
	commitmentHorizon,
	onUrgencyChange,
	onImportanceChange,
	onEffortMinutesChange,
	onCommitmentHorizonChange,
}: EisenhowerAttributeFieldsProps) {
	const t = useTranslations("Tasks");

	const axisOptions = [
		{ value: 1 as const, label: t("axisLight") },
		{ value: 2 as const, label: t("axisMedium") },
		{ value: 3 as const, label: t("axisHeavy") },
	];

	const horizonOptions = HORIZON_VALUES.map((value) => ({
		value,
		label:
			value === "ASAP"
				? t("asap")
				: value === "THIS_WEEK"
					? t("horizonThisWeek")
					: t("horizonWhenPossible"),
	}));

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					{t("fieldUrgency")}
				</span>
				<SegmentedControl
					onChange={(value) => onUrgencyChange(value as 1 | 2 | 3)}
					options={axisOptions}
					value={urgency}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					{t("fieldImportance")}
				</span>
				<SegmentedControl
					onChange={(value) => onImportanceChange(value as 1 | 2 | 3)}
					options={axisOptions}
					value={importance}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					{t("fieldEffort")}
				</span>
				<input
					className="w-24 rounded-md bg-surface-panel px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
					inputMode="numeric"
					max={240}
					min={5}
					onChange={(event) => onEffortMinutesChange(event.target.value)}
					placeholder={t("createEffortPlaceholder")}
					type="number"
					value={effortMinutes}
				/>
				{effortMinutes !== "" && (
					<button
						className="text-text-dimmed text-xs hover:text-text-section"
						onClick={() => onEffortMinutesChange("")}
						type="button"
					>
						{t("createClearEffort")}
					</button>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					{t("fieldHorizon")}
				</span>
				<SegmentedControl
					colorMap={{
						ASAP: "bg-worktype-reactive-bg text-worktype-reactive-text",
						THIS_WEEK: "bg-worktype-deep-bg text-worktype-deep-text",
						WHEN_POSSIBLE: "bg-worktype-ops-bg text-worktype-ops-text",
					}}
					onChange={(value) =>
						onCommitmentHorizonChange(value as CommitmentHorizon)
					}
					options={horizonOptions}
					value={commitmentHorizon}
				/>
			</div>
		</>
	);
}

export type TaskFieldsPanelMode = "create" | "edit";

export type TaskFieldsPanelProps = {
	mode: TaskFieldsPanelMode;
	title: string;
	onTitleChange: (value: string) => void;
	onTitleKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
	includeTitle?: boolean;
	resumeNote?: string;
	onResumeNoteChange?: (value: string) => void;
	resumeNoteFieldId?: string;
	dailyStandingFieldId?: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	onWorkTypeChange: (value: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE") => void;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: string;
	commitmentHorizon: CommitmentHorizon;
	onUrgencyChange: (value: 1 | 2 | 3) => void;
	onImportanceChange: (value: 1 | 2 | 3) => void;
	onEffortMinutesChange: (value: string) => void;
	onCommitmentHorizonChange: (value: CommitmentHorizon) => void;
	isDailyStanding: boolean;
	onIsDailyStandingChange: (value: boolean) => void;
	showAttributeFields?: boolean;
	personaPresetPicker?: ReactNode;
	presetEffortField?: ReactNode;
	project?: string;
	onProjectChange?: (value: string) => void;
	projectFieldId?: string;
	projectSuggestions?: string[];
};

export function TaskFieldsPanel({
	mode,
	title,
	onTitleChange,
	onTitleKeyDown,
	includeTitle = mode === "edit",
	resumeNote = "",
	onResumeNoteChange,
	resumeNoteFieldId,
	dailyStandingFieldId,
	workType,
	onWorkTypeChange,
	urgency,
	importance,
	effortMinutes,
	commitmentHorizon,
	onUrgencyChange,
	onImportanceChange,
	onEffortMinutesChange,
	onCommitmentHorizonChange,
	isDailyStanding,
	onIsDailyStandingChange,
	showAttributeFields = mode === "edit",
	personaPresetPicker,
	presetEffortField,
	project,
	onProjectChange,
	projectFieldId,
	projectSuggestions,
}: TaskFieldsPanelProps) {
	const t = useTranslations("Tasks");
	const showWorkType = mode === "edit" || showAttributeFields;
	const showEisenhower = mode === "edit" || showAttributeFields;

	const workTypeOptions = [
		{ value: "DEEP_WORK" as const, label: t("workType.DEEP_WORK") },
		{ value: "OPERATIONAL" as const, label: t("workType.OPERATIONAL") },
		{ value: "REACTIVE" as const, label: t("workType.REACTIVE") },
	];

	return (
		<div className="space-y-2" data-testid={`task-fields-panel-${mode}`}>
			{includeTitle && (
				<textarea
					className={`${TITLE_FIELD_CLASS} resize-y`}
					data-testid="task-fields-title"
					onChange={(event) => onTitleChange(event.target.value)}
					onKeyDown={onTitleKeyDown}
					rows={2}
					value={title}
				/>
			)}
			{mode === "edit" && onResumeNoteChange != null && (
				<>
					<label
						className="block text-text-secondary text-xs"
						htmlFor={resumeNoteFieldId}
					>
						{t("resumeNoteLabel")}
					</label>
					<textarea
						className="w-full resize-none rounded-lg border border-border-subtle bg-surface-card px-4 py-2 text-primary text-sm focus:border-text-secondary focus:outline-none"
						id={resumeNoteFieldId}
						maxLength={120}
						onChange={(event) => onResumeNoteChange(event.target.value)}
						placeholder={t("resumeNotePlaceholder")}
						rows={2}
						value={resumeNote}
					/>
				</>
			)}
			{mode === "create" && personaPresetPicker}
			<StyledCheckbox
				checked={isDailyStanding}
				data-testid="daily-standing-toggle"
				id={dailyStandingFieldId}
				label={t("dailyStanding")}
				onChange={onIsDailyStandingChange}
			/>
			{mode === "create" && presetEffortField}
			{onProjectChange != null && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="w-16 shrink-0 text-text-secondary text-xs">
						{t("fieldProject")}
					</span>
					<input
						className="min-w-[8rem] flex-1 rounded-md bg-surface-panel px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
						data-testid="task-project-input"
						id={projectFieldId}
						list={
							projectFieldId != null
								? `${projectFieldId}-suggestions`
								: undefined
						}
						onChange={(event) => onProjectChange(event.target.value)}
						placeholder={t("projectPlaceholder")}
						type="text"
						value={project ?? ""}
					/>
					{projectFieldId != null &&
						projectSuggestions != null &&
						projectSuggestions.length > 0 && (
							<datalist id={`${projectFieldId}-suggestions`}>
								{projectSuggestions.map((suggestion) => (
									<option key={suggestion} value={suggestion} />
								))}
							</datalist>
						)}
				</div>
			)}
			{showWorkType && (
				<div
					className={
						mode === "create"
							? "space-y-2 rounded-lg border border-border-subtle bg-surface-panel p-3"
							: "flex flex-wrap items-center gap-2"
					}
					data-testid={
						mode === "create" ? "create-task-custom-panel" : undefined
					}
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="w-16 shrink-0 text-text-secondary text-xs">
							{t("fieldType")}
						</span>
						<SegmentedControl
							colorMap={{
								DEEP_WORK: WORK_TYPE_CONFIG.DEEP_WORK.segmentActive,
								OPERATIONAL: WORK_TYPE_CONFIG.OPERATIONAL.segmentActive,
								REACTIVE: WORK_TYPE_CONFIG.REACTIVE.segmentActive,
							}}
							onChange={onWorkTypeChange}
							options={workTypeOptions}
							value={workType}
						/>
					</div>
					{showEisenhower && (
						<EisenhowerAttributeFields
							commitmentHorizon={commitmentHorizon}
							effortMinutes={effortMinutes}
							importance={importance}
							onCommitmentHorizonChange={onCommitmentHorizonChange}
							onEffortMinutesChange={onEffortMinutesChange}
							onImportanceChange={onImportanceChange}
							onUrgencyChange={onUrgencyChange}
							urgency={urgency}
						/>
					)}
				</div>
			)}
		</div>
	);
}

export { TITLE_FIELD_CLASS };
