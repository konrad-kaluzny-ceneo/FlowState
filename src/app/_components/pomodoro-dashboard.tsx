"use client";

import { Suspense, useMemo } from "react";

import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { TaskList } from "~/app/_components/task-list";
import { TimerPanel } from "~/app/_components/timer-panel";
import { usePomodoroCycle } from "~/hooks/use-pomodoro-cycle";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { useGuestDomainTasks } from "~/lib/data-mode/use-domain-tasks";
import { api } from "~/trpc/react";

function PomodoroDashboardBody({
	tasks,
	refreshTasks,
}: {
	tasks: ReturnType<typeof useGuestDomainTasks>["tasks"];
	refreshTasks: () => Promise<void>;
}) {
	const pomodoro = usePomodoroCycle();

	const activeTaskIds = useMemo(
		() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
		[tasks],
	);

	const canMarkTaskDone =
		pomodoro.focusedTaskId != null && activeTaskIds.has(pomodoro.focusedTaskId);

	const showTimer =
		pomodoro.focusedTask != null ||
		pomodoro.state === "running" ||
		pomodoro.state === "completed";

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-8">
			{pomodoro.error != null && (
				<div
					className="w-full rounded-lg border border-red-400/40 bg-red-500/20 px-4 py-3 text-red-100 text-sm"
					data-testid="pomodoro-error"
					role="alert"
				>
					{pomodoro.error}
					<button
						className="ml-3 underline hover:text-white"
						onClick={pomodoro.clearError}
						type="button"
					>
						Dismiss
					</button>
				</div>
			)}

			{showTimer && (
				<TimerPanel
					cycleKind={pomodoro.cycleKind}
					focusedTask={pomodoro.focusedTask}
					isStarting={false}
					onInterrupt={pomodoro.interrupt}
					onStart={pomodoro.start}
					remainingMs={pomodoro.remainingMs}
					state={pomodoro.state}
				/>
			)}

			<TaskList
				cycleState={pomodoro.state}
				focusedTaskId={pomodoro.focusedTaskId}
				onFocusTask={(taskId, task) => {
					pomodoro.selectTask(taskId, task);
				}}
				onRefresh={refreshTasks}
				tasks={tasks}
			/>

			<CycleCompleteOverlay
				canMarkTaskDone={canMarkTaskDone}
				cycleKind={pomodoro.cycleKind}
				focusedTask={pomodoro.focusedTask}
				onConfirm={pomodoro.confirmComplete}
				state={pomodoro.state}
			/>

			{pomodoro.hasActiveSession && (
				<button
					className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/60 transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
					data-testid="end-session-btn"
					disabled={pomodoro.state === "running"}
					onClick={() => void pomodoro.endSession()}
					type="button"
				>
					End session
				</button>
			)}
		</div>
	);
}

function AuthenticatedPomodoroDashboard() {
	const [tasks] = api.task.list.useSuspenseQuery();
	const utils = api.useUtils();

	const domainTasks = useMemo(
		() => tasks.map((t) => ({ ...t, weight: t.weight as 1 | 2 | 3 })),
		[tasks],
	);

	return (
		<PomodoroDashboardBody
			refreshTasks={async () => {
				await utils.task.list.invalidate();
			}}
			tasks={domainTasks}
		/>
	);
}

function GuestPomodoroDashboard() {
	const { tasks, refresh } = useGuestDomainTasks();

	return <PomodoroDashboardBody refreshTasks={refresh} tasks={tasks} />;
}

export function PomodoroDashboard() {
	const mode = useDataMode();

	if (mode === "guest") {
		return <GuestPomodoroDashboard />;
	}

	return (
		<Suspense
			fallback={
				<p className="text-sm text-white/50" data-testid="dashboard-loading">
					Loading tasks…
				</p>
			}
		>
			<AuthenticatedPomodoroDashboard />
		</Suspense>
	);
}
