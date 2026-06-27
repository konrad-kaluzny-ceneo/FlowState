"use client";

import { ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { useArchiveTasks } from "~/hooks/use-archive-tasks";
import { useTaskMutations } from "~/hooks/use-task-mutations";
import { formatEndedAgo } from "~/lib/catch-up/format-ended-ago";
import type { DomainTask, DomainTaskId } from "~/lib/data-mode/types";
import type { UserLocale } from "~/lib/domain/user-locale";

type TaskArchiveViewProps = {
	onBack: () => void;
	onTasksChanged?: () => Promise<void>;
};

function taskKey(id: DomainTaskId): string {
	return String(id);
}

export function TaskArchiveView({
	onBack,
	onTasksChanged,
}: TaskArchiveViewProps) {
	const locale = useLocale() as UserLocale;
	const t = useTranslations("Tasks");
	const { tasks, isLoading, refresh } = useArchiveTasks();
	const { restoreTask, deleteArchivedTasks, isMutating, error, clearError } =
		useTaskMutations();

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const taskIds = useMemo(
		() => new Set(tasks.map((task) => taskKey(task.id))),
		[tasks],
	);

	useEffect(() => {
		setSelectedIds((current) => {
			const next = new Set<string>();
			for (const id of current) {
				if (taskIds.has(id)) {
					next.add(id);
				}
			}
			return next.size === current.size ? current : next;
		});
	}, [taskIds]);

	const selectedCount = selectedIds.size;
	const allSelected = tasks.length > 0 && selectedCount === tasks.length;
	const someSelected = selectedCount > 0;

	const toggleSelection = useCallback((id: DomainTaskId) => {
		const key = taskKey(id);
		setSelectedIds((current) => {
			const next = new Set(current);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	const toggleSelectAll = useCallback(() => {
		setSelectedIds((current) => {
			if (tasks.length === 0) {
				return current;
			}
			if (current.size === tasks.length) {
				return new Set();
			}
			return new Set(tasks.map((task) => taskKey(task.id)));
		});
	}, [tasks]);

	const handleRestore = useCallback(
		async (id: DomainTaskId) => {
			// Failures surface through useTaskMutations() error state; catch here so
			// the void'd promise from the click handler cannot become an unhandled
			// rejection.
			try {
				await restoreTask({ id });
				setSelectedIds((current) => {
					const next = new Set(current);
					next.delete(taskKey(id));
					return next;
				});
				await refresh();
				await onTasksChanged?.();
			} catch {
				// Intentionally swallowed: error already reflected in hook state.
			}
		},
		[onTasksChanged, refresh, restoreTask],
	);

	const handleDeleteConfirmed = useCallback(async () => {
		const ids = tasks
			.filter((task) => selectedIds.has(taskKey(task.id)))
			.map((task) => task.id);
		if (ids.length === 0) {
			setDeleteConfirmOpen(false);
			return;
		}

		// Failures surface through useTaskMutations() error state; catch here so the
		// void'd promise from the click handler cannot become an unhandled rejection.
		try {
			await deleteArchivedTasks({ ids });
			setSelectedIds(new Set());
			setDeleteConfirmOpen(false);
			await refresh();
			await onTasksChanged?.();
		} catch {
			// Keep the confirm dialog open so the user can retry; error is shown.
		}
	}, [deleteArchivedTasks, onTasksChanged, refresh, selectedIds, tasks]);

	return (
		<div className="w-full max-w-lg space-y-4" data-testid="task-archive-view">
			<div className="flex items-start gap-3">
				<button
					aria-label={t("archiveBack")}
					className="mt-0.5 rounded-lg p-2 text-text-secondary transition hover:bg-surface-panel hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
					data-testid="task-archive-back"
					onClick={onBack}
					type="button"
				>
					<ArrowLeft aria-hidden="true" className="h-5 w-5" />
				</button>
				<div className="min-w-0 flex-1">
					<h2 className="font-semibold text-lg text-text-section">
						{t("archiveTitle")}
					</h2>
					<p className="mt-1 text-sm text-text-secondary">
						{t("archiveDescription")}
					</p>
				</div>
			</div>

			{error != null && (
				<div
					className="rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-3 text-red-100 text-sm"
					data-testid="task-archive-error"
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

			{isLoading ? (
				<p
					className="text-sm text-text-dimmed"
					data-testid="task-archive-loading"
				>
					{t("archiveLoading")}
				</p>
			) : tasks.length === 0 ? (
				<div
					className="rounded-lg border border-border-subtle bg-surface-card px-4 py-8 text-center"
					data-testid="task-archive-empty"
				>
					<p className="font-medium text-primary">{t("archiveEmpty")}</p>
					<p className="mt-2 text-sm text-text-secondary">
						{t("archiveEmptyHint")}
					</p>
				</div>
			) : (
				<>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<label className="flex items-center gap-2 text-sm text-text-secondary">
							<input
								checked={allSelected}
								className="h-4 w-4 rounded border-border-subtle"
								data-testid="task-archive-select-all"
								onChange={toggleSelectAll}
								ref={(input) => {
									if (input != null) {
										input.indeterminate = someSelected && !allSelected;
									}
								}}
								type="checkbox"
							/>
							{t("archiveSelectAll")}
						</label>
						{someSelected && (
							<p
								className="text-sm text-text-secondary"
								data-testid="task-archive-selected-count"
							>
								{t("archiveSelectedCount", { count: selectedCount })}
							</p>
						)}
					</div>

					<ul className="space-y-2">
						{tasks.map((task) => (
							<ArchivedTaskRow
								isMutating={isMutating}
								isSelected={selectedIds.has(taskKey(task.id))}
								key={taskKey(task.id)}
								locale={locale}
								onRestore={() => void handleRestore(task.id)}
								onToggleSelect={() => toggleSelection(task.id)}
								t={t}
								task={task}
							/>
						))}
					</ul>

					{someSelected && (
						<button
							className="w-full rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 font-medium text-red-200 text-sm transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
							data-testid="task-archive-delete-selected"
							disabled={isMutating}
							onClick={() => setDeleteConfirmOpen(true)}
							type="button"
						>
							{t("archiveDeleteSelected")}
						</button>
					)}
				</>
			)}

			{deleteConfirmOpen && (
				<OverlayScrim
					ariaDescribedBy="archive-delete-confirm-description"
					ariaLabelledBy="archive-delete-confirm-heading"
					onEscape={isMutating ? undefined : () => setDeleteConfirmOpen(false)}
					role="dialog"
					testId="task-archive-delete-confirm"
					zIndex={58}
				>
					<OverlayCard>
						<h2
							className="font-semibold text-2xl text-primary"
							id="archive-delete-confirm-heading"
						>
							{t("archiveDeleteConfirmTitle")}
						</h2>
						<p
							className="mt-4 text-sm text-text-secondary"
							data-testid="archive-delete-confirm-description"
							id="archive-delete-confirm-description"
						>
							{t("archiveDeleteConfirmBody")}
						</p>
						<div className="mt-8 flex flex-col gap-3">
							<button
								className={`${overlayButtonClass.primaryFull} disabled:cursor-not-allowed`}
								data-testid="task-archive-delete-confirm-btn"
								disabled={isMutating}
								onClick={() => void handleDeleteConfirmed()}
								type="button"
							>
								{t("archiveDeleteConfirmBtn")}
							</button>
							<button
								className={overlayButtonClass.secondaryFull}
								data-testid="task-archive-delete-cancel-btn"
								disabled={isMutating}
								onClick={() => setDeleteConfirmOpen(false)}
								type="button"
							>
								{t("archiveDeleteCancel")}
							</button>
						</div>
					</OverlayCard>
				</OverlayScrim>
			)}
		</div>
	);
}

function ArchivedTaskRow({
	task,
	isSelected,
	isMutating,
	onToggleSelect,
	onRestore,
	locale,
	t,
}: {
	task: DomainTask;
	isSelected: boolean;
	isMutating: boolean;
	onToggleSelect: () => void;
	onRestore: () => void;
	locale: UserLocale;
	t: ReturnType<typeof useTranslations<"Tasks">>;
}) {
	const archivedAt = task.archivedAt ?? task.updatedAt ?? task.createdAt;

	return (
		<li
			className="flex max-w-full flex-col gap-2 overflow-hidden rounded-lg border border-transparent bg-surface-card-muted px-4 py-3"
			data-testid="archived-task-row"
		>
			<div className="flex w-full min-w-0 items-start gap-2">
				<input
					aria-label={t("archiveSelectRowAria", { title: task.title })}
					checked={isSelected}
					className="mt-1 h-4 w-4 shrink-0 rounded border-border-subtle"
					data-testid="archived-task-checkbox"
					onChange={onToggleSelect}
					type="checkbox"
				/>
				<div className="min-w-0 flex-1">
					<p className="whitespace-pre-wrap break-all text-primary text-sm">
						{task.title}
					</p>
					<p className="mt-1 text-text-dimmed text-xs">
						{t("archiveArchivedAgo", {
							ago: formatEndedAgo(archivedAt.getTime(), Date.now(), locale),
						})}
					</p>
				</div>
				<button
					aria-label={t("archiveRestoreAria")}
					className="shrink-0 rounded-lg bg-surface-panel px-3 py-1.5 text-text-secondary text-xs transition hover:bg-surface-card hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
					data-testid="archived-task-restore"
					disabled={isMutating}
					onClick={onRestore}
					type="button"
				>
					{t("archiveRestoreLabel")}
				</button>
			</div>
		</li>
	);
}
