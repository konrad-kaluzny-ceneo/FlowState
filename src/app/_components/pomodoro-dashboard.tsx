"use client";

import { Suspense, useMemo } from "react";

import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { TaskList } from "~/app/_components/task-list";
import { TimerPanel } from "~/app/_components/timer-panel";
import { usePomodoroCycle } from "~/hooks/use-pomodoro-cycle";
import { api } from "~/trpc/react";

function PomodoroDashboardInner() {
	const pomodoro = usePomodoroCycle();
	const [tasks] = api.task.list.useSuspenseQuery();

	const activeTaskIds = useMemo(
		() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
		[tasks],
	);

	const canMarkTaskDone =
		pomodoro.focusedTaskId != null && activeTaskIds.has(pomodoro.focusedTaskId);

	const showTimer =
		pomodoro.focusedTask != null || pomodoro.state === "running";

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-8">
			{showTimer && (
				<TimerPanel
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
			/>

			<CycleCompleteOverlay
				canMarkTaskDone={canMarkTaskDone}
				focusedTask={pomodoro.focusedTask}
				onConfirm={pomodoro.confirmComplete}
				state={pomodoro.state}
			/>
		</div>
	);
}

export function PomodoroDashboard() {
	return (
		<Suspense
			fallback={
				<p className="text-sm text-white/50" data-testid="dashboard-loading">
					Loading tasks…
				</p>
			}
		>
			<PomodoroDashboardInner />
		</Suspense>
	);
}
