"use client";

import { useState } from "react";

import { useRepositories } from "~/lib/data-mode/data-mode-context";
import type { DomainTask, DomainTaskId } from "~/lib/data-mode/types";

const WORK_TYPE_CONFIG = {
	DEEP_WORK: { label: "Deep", bg: "bg-blue-500/20", text: "text-blue-300" },
	OPERATIONAL: { label: "Ops", bg: "bg-amber-500/20", text: "text-amber-300" },
	REACTIVE: { label: "Reactive", bg: "bg-rose-500/20", text: "text-rose-300" },
} as const;

const WEIGHT_LABELS = { 1: "Light", 2: "Medium", 3: "Heavy" } as const;

function TaskBadges({
	workType,
	weight,
	dimmed = false,
}: {
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: 1 | 2 | 3;
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
				{WEIGHT_LABELS[weight]}
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
						aria-pressed={isActive}
						className={`rounded-md px-2 py-1 font-medium text-xs transition ${
							isActive
								? activeColor
								: "bg-white/10 text-white/60 hover:bg-white/20"
						}`}
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						onMouseDown={(e) => e.preventDefault()}
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
	highlightedTaskId?: DomainTaskId | null;
	onFocusTask: (taskId: DomainTaskId, task: DomainTask) => void;
	cycleState: "idle" | "running" | "completed";
	cycleKind?: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	onMidCycleMarkComplete?: (taskId: DomainTaskId, task: DomainTask) => void;
};

export function TaskList({
	tasks,
	onRefresh,
	focusedTaskId,
	highlightedTaskId = null,
	onFocusTask,
	cycleState,
	cycleKind = null,
	onMidCycleMarkComplete,
}: TaskListProps) {
	const { tasks: taskRepo } = useRepositories();

	const [newTitle, setNewTitle] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [newWorkType, setNewWorkType] = useState<
		"DEEP_WORK" | "OPERATIONAL" | "REACTIVE"
	>("OPERATIONAL");
	const [newWeight, setNewWeight] = useState<1 | 2 | 3>(2);
	const [editingId, setEditingId] = useState<DomainTaskId | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editWorkType, setEditWorkType] = useState<
		"DEEP_WORK" | "OPERATIONAL" | "REACTIVE"
	>("OPERATIONAL");
	const [editWeight, setEditWeight] = useState<1 | 2 | 3>(2);
	const [isPending, setIsPending] = useState(false);

	const activeTasks = tasks.filter((t) => t.status === "active");
	const completedTasks = tasks.filter((t) => t.status === "completed");
	const cycleLocked = cycleState === "running" || cycleState === "completed";
	const isBreakCycle =
		cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
	const focusLocked =
		(cycleState === "running" && cycleKind === "WORK") ||
		cycleState === "completed";
	const markCompleteLocked =
		cycleState === "completed" ||
		isBreakCycle ||
		(cycleState === "running" && cycleKind !== "WORK");
	const canMidCycleMarkComplete =
		cycleState === "running" &&
		cycleKind === "WORK" &&
		onMidCycleMarkComplete != null;

	function startEditing(task: DomainTask) {
		setEditingId(task.id);
		setEditTitle(task.title);
		setEditWorkType(task.workType);
		setEditWeight(task.weight);
	}

	async function saveEdit(id: DomainTaskId) {
		if (!editTitle.trim()) {
			return;
		}

		setIsPending(true);
		try {
			await taskRepo.update({
				id,
				title: editTitle.trim(),
				workType: editWorkType,
				weight: editWeight,
			});
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
				className="space-y-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (!newTitle.trim()) {
						return;
					}

					void (async () => {
						setIsPending(true);
						try {
							await taskRepo.create({
								title: newTitle.trim(),
								workType: newWorkType,
								weight: newWeight,
							});
							await onRefresh();
							setNewTitle("");
							setShowDetails(false);
							setNewWorkType("OPERATIONAL");
							setNewWeight(2);
						} finally {
							setIsPending(false);
						}
					})();
				}}
			>
				<div className="flex gap-2">
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
				</div>
				<button
					className="text-white/50 text-xs transition hover:text-white/80"
					onClick={() => setShowDetails(!showDetails)}
					type="button"
				>
					{showDetails ? "− Details" : "+ Details"}
				</button>
				{showDetails && (
					<div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
						<div className="flex items-center gap-2">
							<span className="w-16 text-white/60 text-xs">Type</span>
							<SegmentedControl
								colorMap={{
									DEEP_WORK: "bg-blue-500/30 text-blue-300",
									OPERATIONAL: "bg-amber-500/30 text-amber-300",
									REACTIVE: "bg-rose-500/30 text-rose-300",
								}}
								onChange={setNewWorkType}
								options={[
									{ value: "DEEP_WORK" as const, label: "Deep" },
									{ value: "OPERATIONAL" as const, label: "Ops" },
									{ value: "REACTIVE" as const, label: "Reactive" },
								]}
								value={newWorkType}
							/>
						</div>
						<div className="flex items-center gap-2">
							<span className="w-16 text-white/60 text-xs">Weight</span>
							<SegmentedControl
								onChange={(v) => setNewWeight(v as 1 | 2 | 3)}
								options={[
									{ value: 1 as const, label: "Light" },
									{ value: 2 as const, label: "Medium" },
									{ value: 3 as const, label: "Heavy" },
								]}
								value={newWeight}
							/>
						</div>
					</div>
				)}
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
								} ${
									highlightedTaskId === task.id
										? "ring-2 ring-amber-400/80"
										: ""
								}`}
								data-testid={
									highlightedTaskId === task.id
										? "suggested-task-row"
										: undefined
								}
								key={String(task.id)}
							>
								<button
									aria-label="Mark complete"
									className="h-5 w-5 shrink-0 rounded border-2 border-white/40 transition hover:border-green-400 hover:bg-green-400/20 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={markCompleteLocked || isPending}
									onClick={() => {
										if (canMidCycleMarkComplete) {
											onMidCycleMarkComplete(task.id, task);
											return;
										}

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
									<div className="flex-1 space-y-2">
										<input
											className="w-full rounded bg-white/10 px-2 py-1 text-white focus:outline-none"
											onBlur={() => void saveEdit(task.id)}
											onChange={(e) => setEditTitle(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") void saveEdit(task.id);
												if (e.key === "Escape") setEditingId(null);
											}}
											type="text"
											value={editTitle}
										/>
										<div className="flex items-center gap-2">
											<span className="w-16 text-white/60 text-xs">Type</span>
											<SegmentedControl
												colorMap={{
													DEEP_WORK: "bg-blue-500/30 text-blue-300",
													OPERATIONAL: "bg-amber-500/30 text-amber-300",
													REACTIVE: "bg-rose-500/30 text-rose-300",
												}}
												onChange={setEditWorkType}
												options={[
													{ value: "DEEP_WORK" as const, label: "Deep" },
													{ value: "OPERATIONAL" as const, label: "Ops" },
													{ value: "REACTIVE" as const, label: "Reactive" },
												]}
												value={editWorkType}
											/>
										</div>
										<div className="flex items-center gap-2">
											<span className="w-16 text-white/60 text-xs">Weight</span>
											<SegmentedControl
												onChange={(v) => setEditWeight(v as 1 | 2 | 3)}
												options={[
													{ value: 1 as const, label: "Light" },
													{ value: 2 as const, label: "Medium" },
													{ value: 3 as const, label: "Heavy" },
												]}
												value={editWeight}
											/>
										</div>
									</div>
								) : (
									<button
										className="flex-1 cursor-pointer text-left text-white disabled:cursor-default disabled:opacity-70"
										disabled={cycleLocked}
										onClick={() => startEditing(task)}
										type="button"
									>
										{task.title}
									</button>
								)}
								<TaskBadges weight={task.weight} workType={task.workType} />
								<button
									className={`shrink-0 rounded-lg px-2 py-1 font-medium text-xs transition ${
										focusedTaskId === task.id
											? "bg-purple-600 text-white"
											: "bg-white/10 text-white/80 hover:bg-white/20"
									}`}
									disabled={focusLocked}
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
									weight={task.weight}
									workType={task.workType}
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
