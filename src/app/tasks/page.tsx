"use client";

import { Suspense, useState } from "react";

import { usePomodoroCycleContext } from "~/app/_components/pomodoro-cycle-provider";
import { TaskArchiveView } from "~/app/_components/task-archive-view";
import { TaskList } from "~/app/_components/task-list";
import { useDailyRecap } from "~/hooks/use-daily-recap";
import { useDayPlan } from "~/hooks/use-day-plan";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import {
	useAuthenticatedDomainTasks,
	useGuestDomainTasks,
} from "~/lib/data-mode/use-domain-tasks";

function AuthenticatedTasksPage() {
	const dayPlan = useDayPlan();
	const { tasks, refresh } = useAuthenticatedDomainTasks({
		localDateKey: dayPlan.localDateKey,
		enabled: true,
	});
	const pomodoro = usePomodoroCycleContext();
	const { recap } = useDailyRecap();
	const [view, setView] = useState<"inventory" | "archive">("inventory");

	if (view === "archive") {
		return (
			<div className="flex flex-1 flex-col items-center px-4 py-8">
				<div className="w-full max-w-2xl">
					<TaskArchiveView
						onBack={() => setView("inventory")}
						onTasksChanged={refresh}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<TaskList
					chromeSubdued={false}
					continueTaskId={pomodoro.continueTaskId}
					cycleKind={pomodoro.cycleKind}
					cycleState={pomodoro.state}
					focusedTaskId={pomodoro.focusedTaskId}
					focusShellActive={false}
					footprints={recap.footprints}
					highlightedTaskId={
						pomodoro.suggestedTaskId ?? pomodoro.kickoffSuggestedTaskId ?? null
					}
					onFocusTask={(taskId, task) => {
						pomodoro.selectTask(taskId, task);
					}}
					onMidCycleMarkComplete={(taskId, task) => {
						pomodoro.onMidCycleMarkComplete(taskId, task);
					}}
					onOpenArchive={() => setView("archive")}
					onRefresh={refresh}
					suggestionLoading={false}
					tasks={tasks}
				/>
			</div>
		</div>
	);
}

function GuestTasksPage() {
	const { tasks, refresh } = useGuestDomainTasks();
	const pomodoro = usePomodoroCycleContext();
	const [view, setView] = useState<"inventory" | "archive">("inventory");

	if (view === "archive") {
		return (
			<div className="flex flex-1 flex-col items-center px-4 py-8">
				<div className="w-full max-w-2xl">
					<TaskArchiveView
						onBack={() => setView("inventory")}
						onTasksChanged={refresh}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<TaskList
					chromeSubdued={false}
					continueTaskId={pomodoro.continueTaskId}
					cycleKind={pomodoro.cycleKind}
					cycleState={pomodoro.state}
					focusedTaskId={pomodoro.focusedTaskId}
					focusShellActive={false}
					highlightedTaskId={
						pomodoro.suggestedTaskId ?? pomodoro.kickoffSuggestedTaskId ?? null
					}
					onFocusTask={(taskId, task) => {
						pomodoro.selectTask(taskId, task);
					}}
					onMidCycleMarkComplete={(taskId, task) => {
						pomodoro.onMidCycleMarkComplete(taskId, task);
					}}
					onOpenArchive={() => setView("archive")}
					onRefresh={refresh}
					suggestionLoading={false}
					tasks={tasks}
				/>
			</div>
		</div>
	);
}

export default function TasksPage() {
	const mode = useDataMode();

	if (mode === "guest") {
		return <GuestTasksPage />;
	}

	return (
		<Suspense
			fallback={
				<p className="p-8 text-center text-sm text-text-dimmed">
					Loading tasks…
				</p>
			}
		>
			<AuthenticatedTasksPage />
		</Suspense>
	);
}
