"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import {
	ModalShell,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type { DomainTask } from "~/lib/data-mode/types";
import type {
	DomainContextTag,
	DomainScheduleBlock,
	GtdFixedContext,
	ScheduleBlockType,
} from "~/lib/schedule/types";
import {
	AXIS_END_MINUTE,
	AXIS_START_MINUTE,
	SNAP_MINUTES,
} from "~/lib/schedule/types";

const BLOCK_TYPES: ScheduleBlockType[] = [
	"FOCUS",
	"MEETING",
	"BREAK",
	"PERSONAL",
	"PLANNING",
	"BATCH",
];

const FIXED_CONTEXTS: GtdFixedContext[] = [
	"PHONE",
	"COMPUTER",
	"OFFICE",
	"ERRANDS",
];

const BLOCK_TYPE_KEY: Record<ScheduleBlockType, string> = {
	FOCUS: "blockFocus",
	MEETING: "blockMeeting",
	BREAK: "blockBreak",
	PERSONAL: "blockPersonal",
	PLANNING: "blockPlanning",
	BATCH: "blockBatch",
};

const FIXED_CONTEXT_KEY: Record<GtdFixedContext, string> = {
	PHONE: "contextPhone",
	COMPUTER: "contextComputer",
	OFFICE: "contextOffice",
	ERRANDS: "contextErrands",
};

type UpdateBlockInput = {
	blockId: number;
	blockType?: ScheduleBlockType;
	startMinute?: number;
	durationMinutes?: number;
	metaLabel?: string | null;
	fixedContext?: GtdFixedContext | null;
	customContextTagId?: number | null;
	focusTaskId?: number | null;
	batchTaskIds?: number[];
};

export type ScheduleBlockEditPanelProps = {
	block: DomainScheduleBlock;
	tasks: DomainTask[];
	contextTags: DomainContextTag[];
	onClose: () => void;
	updateBlock: (input: UpdateBlockInput) => Promise<unknown>;
	deleteBlock: (blockId: number) => Promise<unknown>;
	createContextTag: (label: string) => Promise<DomainContextTag>;
};

function formatMinute(minute: number): string {
	const hours = Math.floor(minute / 60);
	const minutes = minute % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function numericTaskId(task: DomainTask): number | null {
	if (typeof task.id === "number") {
		return task.id;
	}
	const parsed = Number(task.id);
	return Number.isInteger(parsed) ? parsed : null;
}

export function ScheduleBlockEditPanel({
	block,
	tasks,
	contextTags,
	onClose,
	updateBlock,
	deleteBlock,
	createContextTag,
}: ScheduleBlockEditPanelProps) {
	const t = useTranslations("PlanDnia");
	const [blockType, setBlockType] = useState(block.blockType);
	const [startMinute, setStartMinute] = useState(block.startMinute);
	const [durationMinutes, setDurationMinutes] = useState(block.durationMinutes);
	const [metaLabel, setMetaLabel] = useState(block.metaLabel ?? "");
	const [focusTaskId, setFocusTaskId] = useState<number | null>(
		block.focusTaskId,
	);
	const [batchTaskIds, setBatchTaskIds] = useState<number[]>(
		block.batchTaskIds,
	);
	const [contextValue, setContextValue] = useState(
		block.fixedContext != null
			? `fixed:${block.fixedContext}`
			: block.customContextTagId != null
				? `tag:${block.customContextTagId}`
				: "",
	);
	const [newTagLabel, setNewTagLabel] = useState("");
	const [localContextTags, setLocalContextTags] = useState(contextTags);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showMore, setShowMore] = useState(
		block.fixedContext != null || block.customContextTagId != null,
	);

	useEffect(() => {
		setBlockType(block.blockType);
		setStartMinute(block.startMinute);
		setDurationMinutes(block.durationMinutes);
		setMetaLabel(block.metaLabel ?? "");
		setFocusTaskId(block.focusTaskId);
		setBatchTaskIds(block.batchTaskIds);
		setContextValue(
			block.fixedContext != null
				? `fixed:${block.fixedContext}`
				: block.customContextTagId != null
					? `tag:${block.customContextTagId}`
					: "",
		);
		setLocalContextTags(contextTags);
		setConfirmDelete(false);
		setError(null);
		setShowMore(block.fixedContext != null || block.customContextTagId != null);
	}, [block, contextTags]);

	const availableTasks = useMemo(
		() =>
			tasks
				.filter((task) => task.status === "active" || task.status === "planned")
				.map((task) => ({ task, id: numericTaskId(task) }))
				.filter(
					(entry): entry is { task: DomainTask; id: number } =>
						entry.id != null,
				),
		[tasks],
	);

	const startOptions = useMemo(() => {
		const latestStart = AXIS_END_MINUTE - SNAP_MINUTES;
		const values: number[] = [];
		for (
			let minute = AXIS_START_MINUTE;
			minute <= latestStart;
			minute += SNAP_MINUTES
		) {
			values.push(minute);
		}
		return values;
	}, []);

	const durationOptions = useMemo(() => {
		const values: number[] = [];
		for (
			let minutes = SNAP_MINUTES;
			startMinute + minutes <= AXIS_END_MINUTE;
			minutes += SNAP_MINUTES
		) {
			values.push(minutes);
		}
		return values;
	}, [startMinute]);

	useEffect(() => {
		const maxDuration = AXIS_END_MINUTE - startMinute;
		if (durationMinutes > maxDuration) {
			setDurationMinutes(maxDuration);
		}
	}, [durationMinutes, startMinute]);

	async function handleSave() {
		setError(null);
		const fixedContext = contextValue.startsWith("fixed:")
			? (contextValue.slice(6) as GtdFixedContext)
			: null;
		const customContextTagId = contextValue.startsWith("tag:")
			? Number(contextValue.slice(4))
			: null;

		const input = {
			blockId: block.id,
			blockType,
			startMinute,
			durationMinutes,
			metaLabel: blockType === "BATCH" ? metaLabel : null,
			fixedContext,
			customContextTagId,
			...(blockType === "FOCUS" ? { focusTaskId } : {}),
			...(blockType === "BATCH" ? { batchTaskIds } : {}),
		};

		// Optimistic close — hook already patches list cache (S-09 ≤200ms).
		onClose();
		void updateBlock(input).catch(() => {
			// Parent timeline surfaces scheduleSaveError via hook error state.
		});
	}

	async function handleCreateTag() {
		if (newTagLabel.trim().length === 0) {
			return;
		}
		setIsSaving(true);
		setError(null);
		try {
			const created = await createContextTag(newTagLabel);
			setLocalContextTags((current) => [
				...current.filter((tag) => tag.id !== created.id),
				created,
			]);
			setContextValue(`tag:${created.id}`);
			setNewTagLabel("");
		} catch {
			setError(t("contextTagCreateError"));
		} finally {
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!confirmDelete) {
			setConfirmDelete(true);
			return;
		}
		setIsSaving(true);
		setError(null);
		try {
			await deleteBlock(block.id);
			onClose();
		} catch {
			setError(t("scheduleDeleteError"));
			setIsSaving(false);
		}
	}

	return (
		<ModalShell
			maxWidth="lg"
			onEscape={onClose}
			testId="schedule-block-edit-panel"
			title={t("editBlock")}
			titleId="schedule-block-edit-title"
		>
			<div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
				<label className="block text-sm text-text-secondary">
					<span className="mb-1 block font-medium text-text-section">
						{t("blockTypeLabel")}
					</span>
					<select
						className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
						data-testid="schedule-block-type"
						onChange={(event) =>
							setBlockType(event.target.value as ScheduleBlockType)
						}
						value={blockType}
					>
						{BLOCK_TYPES.map((type) => (
							<option key={type} value={type}>
								{t(BLOCK_TYPE_KEY[type])}
							</option>
						))}
					</select>
				</label>

				<div className="grid grid-cols-2 gap-3">
					<label className="text-sm text-text-secondary">
						<span className="mb-1 block font-medium text-text-section">
							{t("startTimeLabel")}
						</span>
						<select
							className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
							data-testid="schedule-block-start"
							onChange={(event) => setStartMinute(Number(event.target.value))}
							value={startMinute}
						>
							{startOptions.map((minute) => (
								<option key={minute} value={minute}>
									{formatMinute(minute)}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm text-text-secondary">
						<span className="mb-1 block font-medium text-text-section">
							{t("durationLabel")}
						</span>
						<select
							className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
							data-testid="schedule-block-duration"
							onChange={(event) =>
								setDurationMinutes(Number(event.target.value))
							}
							value={durationMinutes}
						>
							{durationOptions.map((minutes) => (
								<option key={minutes} value={minutes}>
									{t("durationMinutes", { minutes })}
								</option>
							))}
						</select>
					</label>
				</div>

				{blockType === "FOCUS" ? (
					<label className="block text-sm text-text-secondary">
						<span className="mb-1 block font-medium text-text-section">
							{t("focusTaskLabel")}
						</span>
						<select
							className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
							data-testid="schedule-focus-task"
							onChange={(event) =>
								setFocusTaskId(
									event.target.value === "" ? null : Number(event.target.value),
								)
							}
							value={focusTaskId ?? ""}
						>
							<option value="">{t("noTaskOption")}</option>
							{availableTasks.map(({ task, id }) => (
								<option key={id} value={id}>
									{task.title}
								</option>
							))}
						</select>
					</label>
				) : null}

				{blockType === "BATCH" ? (
					<div className="space-y-3">
						<label className="block text-sm text-text-secondary">
							<span className="mb-1 block font-medium text-text-section">
								{t("metaLabelLabel")}
							</span>
							<input
								className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
								data-testid="schedule-meta-label"
								maxLength={120}
								onChange={(event) => setMetaLabel(event.target.value)}
								placeholder={t("metaLabelPlaceholder")}
								value={metaLabel}
							/>
						</label>
						<fieldset>
							<legend className="mb-2 font-medium text-sm text-text-section">
								{t("batchTasksLabel")}
							</legend>
							<div className="max-h-40 space-y-2 overflow-y-auto rounded-control border border-border-subtle p-3">
								{availableTasks.length === 0 ? (
									<p className="text-sm text-text-dimmed">
										{t("noAttachableTasks")}
									</p>
								) : (
									availableTasks.map(({ task, id }) => (
										<label
											className="flex items-center gap-2 text-primary text-sm"
											key={id}
										>
											<input
												checked={batchTaskIds.includes(id)}
												data-testid={`schedule-batch-task-${id}`}
												onChange={(event) =>
													setBatchTaskIds((current) =>
														event.target.checked
															? [...current, id]
															: current.filter((taskId) => taskId !== id),
													)
												}
												type="checkbox"
											/>
											<span>{task.title}</span>
										</label>
									))
								)}
							</div>
						</fieldset>
					</div>
				) : null}

				<p className="text-text-dimmed text-xs">{t("editTimeHint")}</p>

				<div className="border-border-subtle border-t pt-3">
					<button
						className="text-sm text-text-secondary hover:text-text-section"
						data-testid="schedule-edit-more-toggle"
						onClick={() => setShowMore((open) => !open)}
						type="button"
					>
						{showMore ? t("editLessDetails") : t("editMoreDetails")}
					</button>
					{showMore ? (
						<div className="mt-3 space-y-3">
							<label className="block text-sm text-text-secondary">
								<span className="mb-1 block font-medium text-text-section">
									{t("contextLabel")}
								</span>
								<select
									className="w-full rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
									data-testid="schedule-context"
									onChange={(event) => setContextValue(event.target.value)}
									value={contextValue}
								>
									<option value="">{t("noContextOption")}</option>
									{FIXED_CONTEXTS.map((context) => (
										<option key={context} value={`fixed:${context}`}>
											{t(FIXED_CONTEXT_KEY[context])}
										</option>
									))}
									{localContextTags.map((tag) => (
										<option key={tag.id} value={`tag:${tag.id}`}>
											{tag.label}
										</option>
									))}
								</select>
							</label>
							<div className="flex gap-2">
								<input
									className="min-w-0 flex-1 rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-primary"
									data-testid="schedule-new-context-tag"
									maxLength={32}
									onChange={(event) => setNewTagLabel(event.target.value)}
									placeholder={t("customTagPlaceholder")}
									value={newTagLabel}
								/>
								<button
									className="rounded-control border border-border-subtle px-3 py-2 text-sm text-text-section disabled:opacity-50"
									data-testid="schedule-create-context-tag"
									disabled={isSaving || newTagLabel.trim().length === 0}
									onClick={() => void handleCreateTag()}
									type="button"
								>
									{t("addContextTag")}
								</button>
							</div>
						</div>
					) : null}
				</div>

				{error != null ? (
					<p className="text-red-300 text-sm" role="alert">
						{error}
					</p>
				) : null}

				<div className="flex flex-col gap-2 border-border-subtle border-t pt-4 sm:flex-row">
					<button
						className={`${overlayButtonClass.primary} flex-1 px-4`}
						data-testid="schedule-save-block"
						disabled={isSaving}
						onClick={() => void handleSave()}
						type="button"
					>
						{isSaving ? t("savingBlock") : t("saveBlock")}
					</button>
					<button
						className={`${overlayButtonClass.secondary} flex-1 px-4`}
						disabled={isSaving}
						onClick={onClose}
						type="button"
					>
						{t("cancel")}
					</button>
					<button
						className={`${overlayButtonClass.danger} flex-1 px-4`}
						data-testid="schedule-delete-block"
						disabled={isSaving}
						onClick={() => void handleDelete()}
						type="button"
					>
						{confirmDelete ? t("confirmDeleteBlock") : t("deleteBlock")}
					</button>
				</div>
			</div>
		</ModalShell>
	);
}
