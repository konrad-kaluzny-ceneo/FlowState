"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { StyledCheckbox } from "~/app/_components/styled-checkbox";
import type { CommitmentHorizon } from "~/lib/data-mode/types";
import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";

const HORIZON_OPTIONS: { value: CommitmentHorizon; label: string }[] = [
	{ value: "ASAP", label: "ASAP" },
	{ value: "THIS_WEEK", label: "This week" },
	{ value: "WHEN_POSSIBLE", label: "When possible" },
];

const TITLE_FIELD_CLASS =
	"w-full rounded-lg border border-border-subtle bg-surface-card px-4 py-2 text-primary placeholder:text-text-dimmed focus:border-text-secondary focus:outline-none";

type SegmentedControlProps<T extends string | number> = {
	options: { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
	colorMap?: Record<string, string>;
};

function SegmentedControl<T extends string | number>({
	options,
	value,
	onChange,
	colorMap,
}: SegmentedControlProps<T>) {
	return (
		<div className="flex flex-wrap gap-1">
			{options.map((opt) => {
				const isActive = opt.value === value;
				const activeColor =
					colorMap?.[String(opt.value)] ?? "bg-accent-cta text-on-cta";
				return (
					<button
						aria-pressed={isActive}
						className={`rounded-md px-2 py-1 font-medium text-xs transition ${
							isActive
								? activeColor
								: "bg-surface-panel text-text-secondary hover:bg-surface-card-muted"
						}`}
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						onMouseDown={(event) => event.preventDefault()}
						type="button"
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}

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
	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					Urgency
				</span>
				<SegmentedControl
					onChange={(value) => onUrgencyChange(value as 1 | 2 | 3)}
					options={[
						{ value: 1 as const, label: "Light" },
						{ value: 2 as const, label: "Medium" },
						{ value: 3 as const, label: "Heavy" },
					]}
					value={urgency}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					Importance
				</span>
				<SegmentedControl
					onChange={(value) => onImportanceChange(value as 1 | 2 | 3)}
					options={[
						{ value: 1 as const, label: "Light" },
						{ value: 2 as const, label: "Medium" },
						{ value: 3 as const, label: "Heavy" },
					]}
					value={importance}
				/>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					Effort
				</span>
				<input
					className="w-24 rounded-md bg-surface-panel px-2 py-1 text-primary text-xs placeholder:text-text-dimmed focus:outline-none"
					inputMode="numeric"
					max={240}
					min={5}
					onChange={(event) => onEffortMinutesChange(event.target.value)}
					placeholder="min"
					type="number"
					value={effortMinutes}
				/>
				{effortMinutes !== "" && (
					<button
						className="text-text-dimmed text-xs hover:text-text-section"
						onClick={() => onEffortMinutesChange("")}
						type="button"
					>
						Clear
					</button>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="w-16 shrink-0 text-text-secondary text-xs">
					Horizon
				</span>
				<SegmentedControl
					colorMap={{
						ASAP: "bg-worktype-reactive-bg text-worktype-reactive-text",
						THIS_WEEK: "bg-worktype-deep-bg text-worktype-deep-text",
						WHEN_POSSIBLE: "bg-surface-panel text-text-section",
					}}
					onChange={(value) =>
						onCommitmentHorizonChange(value as CommitmentHorizon)
					}
					options={HORIZON_OPTIONS}
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
}: TaskFieldsPanelProps) {
	const showWorkType = mode === "edit" || showAttributeFields;
	const showEisenhower = mode === "edit" || showAttributeFields;

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
						Where you left off (optional)
					</label>
					<textarea
						className="w-full resize-none rounded-lg border border-border-subtle bg-surface-card px-4 py-2 text-primary text-sm focus:border-text-secondary focus:outline-none"
						id={resumeNoteFieldId}
						maxLength={120}
						onChange={(event) => onResumeNoteChange(event.target.value)}
						placeholder="One line for when you return to this task"
						rows={2}
						value={resumeNote}
					/>
				</>
			)}
			{mode === "create" && personaPresetPicker}
			<StyledCheckbox
				checked={isDailyStanding}
				data-testid="daily-standing-toggle"
				label="Daily standing"
				onChange={onIsDailyStandingChange}
			/>
			{mode === "create" && presetEffortField}
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
							Type
						</span>
						<SegmentedControl
							colorMap={{
								DEEP_WORK: WORK_TYPE_CONFIG.DEEP_WORK.segmentActive,
								OPERATIONAL: WORK_TYPE_CONFIG.OPERATIONAL.segmentActive,
								REACTIVE: WORK_TYPE_CONFIG.REACTIVE.segmentActive,
							}}
							onChange={onWorkTypeChange}
							options={[
								{ value: "DEEP_WORK" as const, label: "Deep" },
								{ value: "OPERATIONAL" as const, label: "Ops" },
								{ value: "REACTIVE" as const, label: "Reactive" },
							]}
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
