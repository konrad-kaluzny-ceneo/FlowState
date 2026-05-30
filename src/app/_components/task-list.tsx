"use client";

import { useState } from "react";

import { useRepositories } from "~/lib/data-mode/data-mode-context";
import type { DomainTask, DomainTaskId } from "~/lib/data-mode/types";

const TASK_DEFAULTS = { workType: "ADMIN" as const, weight: 2 } as const;

const WORK_TYPE_CONFIG = {
	DEEP_WORK: { label: "Deep", bg: "bg-blue-500/20", text: "text-blue-300" },
	ADMIN: { label: "Admin", bg: "bg-amber-500/20", text: "text-amber-300" },
	REACTIVE: { label: "Reactive", bg: "bg-rose-500/20", text: "text-rose-300" },
} as const;

function TaskBadges({
	workType,
	weight,
	dimmed = false,
}: {
	workType: "DEEP_WORK" | "ADMIN" | "REACTIVE";
	weight: number;
	dimmed?: boolean;
}) {
	const config = WORK_TYPE_CONFIG[workType];
	return (
		<span
			className={`flex shrink-0 items-center gap-1 ${dimmed ? "opacity-50" : ""}`}
		>
			<span
				className={`rounded-full px-2 py-0.5 font-medium text-xs ${config.bg} ${config.text}`}
			>
				{config.label}
			</span>
			<span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/70 text-xs">
				W{weight}
			</span>
		</span>
	);
}

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
		<div className="flex gap-1">
			{options.map((opt) => {
				const isActive = opt.value === value;
				const activeColor =
					colorMap?.[String(opt.value)] ?? "bg-purple-600 text-white";
				return (
					<button
						className={`rounded-md px-2 py-1 font-medium text-xs transition ${
							isActive
								? activeColor
								: "bg-white/10 text-white/60 hover:bg-white/20"
						}`}
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						type="button"
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}

type TaskListProps = {
	tasks: DomainTask[];
	onRefresh: () => Promise<void>;
	focusedTaskId: DomainTaskId | null;
	onFocusTask: (taskId: DomainTaskId, task: DomainTask) => void;
	cycleState: "idle" | "running" | "completed";
};

export function TaskList({
	tasks,
	onRefresh,
	focusedTaskId,
	onFocusTask,
	cycleState,
}: TaskListProps) {
	const { tasks: taskRepo } = useRepositories();

	const [newTitle, setNewTitle] = useState("");
	const [editingId, setEditingId] = useState<DomainTaskId | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [isPending, setIsPending] = useState(false);

	const activeTasks = tasks.filter((t) => t.status === "active");
	const completedTasks = tasks.filter((t) => t.status === "completed");
	const cycleLocked = cycleState === "running" || cycleState === "completed";

	function startEditing(id: DomainTaskId, title: string) {
		setEditingId(id);
		setEditTitle(title);
	}

	async function saveEdit(id: DomainTaskId) {
		if (!editTitle.trim()) {
			return;
		}

		setIsPending(true);
		try {
			await taskRepo.update({ id, title: editTitle.trim() });
			await onRefresh();
			setEditingId(null);
			setEditTitle("");
		} finally {
			setIsPending(false);
		}
	}

	return (
		<div className="w-full max-w-lg space-y-6" data-testid="task-list">
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (!newTitle.trim()) {
						return;
					}

					void (async () => {
						setIsPending(true);
						try {
							await taskRepo.create({ title: newTitle.trim() });
							await onRefresh();
							setNewTitle("");
						} finally {
							setIsPending(false);
						}
					})();
				}}
			>
				<input
					className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none"
					onChange={(e) => setNewTitle(e.target.value)}
					placeholder="Add a new task..."
					type="text"
					value={newTitle}
				/>
				<button
					className="rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
					disabled={isPending || !newTitle.trim()}
					type="submit"
				>
					{isPending ? "Adding..." : "Add"}
				</button>
			</form>

			<section>
				<h2 className="mb-2 font-semibold text-lg text-white/80">
					Active ({activeTasks.length})
				</h2>
				{activeTasks.length === 0 ? (
					<p className="text-sm text-white/50">No active tasks</p>
				) : (
					<ul className="space-y-2">
						{activeTasks.map((task) => (
							<li
								className={`flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 ${
									focusedTaskId === task.id ? "ring-2 ring-purple-500" : ""
								}`}
								key={String(task.id)}
							>
								<button
									aria-label="Mark complete"
									className="h-5 w-5 shrink-0 rounded border-2 border-white/40 transition hover:border-green-400 hover:bg-green-400/20 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={cycleLocked || isPending}
									onClick={() => {
										void (async () => {
											setIsPending(true);
											try {
												await taskRepo.update({
													id: task.id,
													status: "completed",
												});
												await onRefresh();
											} finally {
												setIsPending(false);
											}
										})();
									}}
									type="button"
								/>
								{editingId === task.id ? (
									<input
										className="flex-1 rounded bg-white/10 px-2 py-1 text-white focus:outline-none"
										onBlur={() => void saveEdit(task.id)}
										onChange={(e) => setEditTitle(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void saveEdit(task.id);
											if (e.key === "Escape") setEditingId(null);
										}}
										type="text"
										value={editTitle}
									/>
								) : (
									<button
										className="flex-1 cursor-pointer text-left text-white disabled:cursor-default disabled:opacity-70"
										disabled={cycleLocked}
										onClick={() => startEditing(task.id, task.title)}
										type="button"
									>
										{task.title}
									</button>
								)}
								<TaskBadges
									weight={task.weight ?? TASK_DEFAULTS.weight}
									workType={task.workType ?? TASK_DEFAULTS.workType}
								/>
								<button
									className={`shrink-0 rounded-lg px-2 py-1 font-medium text-xs transition ${
										focusedTaskId === task.id
											? "bg-purple-600 text-white"
											: "bg-white/10 text-white/80 hover:bg-white/20"
									}`}
									disabled={cycleLocked}
									onClick={() => onFocusTask(task.id, task)}
									type="button"
								>
									{focusedTaskId === task.id ? "Focused" : "Focus"}
								</button>
								<button
									aria-label="Delete task"
									className="shrink-0 text-white/40 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={cycleLocked || isPending}
									onClick={() => {
										void (async () => {
											setIsPending(true);
											try {
												await taskRepo.delete({ id: task.id });
												await onRefresh();
											} finally {
												setIsPending(false);
											}
										})();
									}}
									type="button"
								>
									✕
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			{completedTasks.length > 0 && (
				<section>
					<h2 className="mb-2 font-semibold text-lg text-white/80">
						Completed ({completedTasks.length})
					</h2>
					<ul className="space-y-2">
						{completedTasks.map((task) => (
							<li
								className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-3"
								key={String(task.id)}
							>
								<button
									aria-label="Revert to active"
									className="h-5 w-5 shrink-0 rounded border-2 border-green-400 bg-green-400/30 transition hover:border-white/40 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
									disabled={cycleLocked || isPending}
									onClick={() => {
										void (async () => {
											setIsPending(true);
											try {
												await taskRepo.update({
													id: task.id,
													status: "active",
												});
												await onRefresh();
											} finally {
												setIsPending(false);
											}
										})();
									}}
									type="button"
								/>
								<span className="flex-1 text-white/50 line-through">
									{task.title}
								</span>
								<TaskBadges
									dimmed
									weight={task.weight ?? TASK_DEFAULTS.weight}
									workType={task.workType ?? TASK_DEFAULTS.workType}
								/>
								<button
									aria-label="Delete task"
									className="shrink-0 text-white/40 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={cycleLocked || isPending}
									onClick={() => {
										void (async () => {
											setIsPending(true);
											try {
												await taskRepo.delete({ id: task.id });
												await onRefresh();
											} finally {
												setIsPending(false);
											}
										})();
									}}
									type="button"
								>
									✕
								</button>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
