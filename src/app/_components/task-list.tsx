"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function TaskList() {
	const [tasks] = api.task.list.useSuspenseQuery();
	const utils = api.useUtils();

	const [newTitle, setNewTitle] = useState("");
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editTitle, setEditTitle] = useState("");

	const createTask = api.task.create.useMutation({
		onSuccess: async () => {
			await utils.task.list.invalidate();
			setNewTitle("");
		},
	});

	const updateTask = api.task.update.useMutation({
		onSuccess: async () => {
			await utils.task.list.invalidate();
			setEditingId(null);
			setEditTitle("");
		},
	});

	const deleteTask = api.task.delete.useMutation({
		onSuccess: async () => {
			await utils.task.list.invalidate();
		},
	});

	const activeTasks = tasks.filter((t) => t.status === "active");
	const completedTasks = tasks.filter((t) => t.status === "completed");

	function startEditing(id: number, title: string) {
		setEditingId(id);
		setEditTitle(title);
	}

	function saveEdit(id: number) {
		if (editTitle.trim()) {
			updateTask.mutate({ id, title: editTitle.trim() });
		}
	}

	return (
		<div className="w-full max-w-lg space-y-6">
			{/* Add task form */}
			<form
				className="flex gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (newTitle.trim()) {
						createTask.mutate({ title: newTitle.trim() });
					}
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
					disabled={createTask.isPending || !newTitle.trim()}
					type="submit"
				>
					{createTask.isPending ? "Adding..." : "Add"}
				</button>
			</form>

			{/* Active tasks */}
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
								className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3"
								key={task.id}
							>
								<button
									aria-label="Mark complete"
									className="h-5 w-5 shrink-0 rounded border-2 border-white/40 transition hover:border-green-400 hover:bg-green-400/20"
									onClick={() =>
										updateTask.mutate({ id: task.id, status: "completed" })
									}
									type="button"
								/>
								{editingId === task.id ? (
									<input
										autoFocus
										className="flex-1 rounded bg-white/10 px-2 py-1 text-white focus:outline-none"
										onBlur={() => saveEdit(task.id)}
										onChange={(e) => setEditTitle(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") saveEdit(task.id);
											if (e.key === "Escape") setEditingId(null);
										}}
										type="text"
										value={editTitle}
									/>
								) : (
									<span
										className="flex-1 cursor-pointer text-white"
										onClick={() => startEditing(task.id, task.title)}
										onKeyDown={(e) => {
											if (e.key === "Enter")
												startEditing(task.id, task.title);
										}}
										role="button"
										tabIndex={0}
									>
										{task.title}
									</span>
								)}
								<button
									aria-label="Delete task"
									className="shrink-0 text-white/40 transition hover:text-red-400"
									onClick={() => deleteTask.mutate({ id: task.id })}
									type="button"
								>
									✕
								</button>
							</li>
						))}
					</ul>
				)}
			</section>

			{/* Completed tasks */}
			{completedTasks.length > 0 && (
				<section>
					<h2 className="mb-2 font-semibold text-lg text-white/80">
						Completed ({completedTasks.length})
					</h2>
					<ul className="space-y-2">
						{completedTasks.map((task) => (
							<li
								className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-3"
								key={task.id}
							>
								<button
									aria-label="Revert to active"
									className="h-5 w-5 shrink-0 rounded border-2 border-green-400 bg-green-400/30 transition hover:border-white/40 hover:bg-transparent"
									onClick={() =>
										updateTask.mutate({ id: task.id, status: "active" })
									}
									type="button"
								/>
								<span className="flex-1 text-white/50 line-through">
									{task.title}
								</span>
								<button
									aria-label="Delete task"
									className="shrink-0 text-white/40 transition hover:text-red-400"
									onClick={() => deleteTask.mutate({ id: task.id })}
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
