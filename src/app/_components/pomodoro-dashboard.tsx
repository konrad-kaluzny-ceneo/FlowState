"use client";

import { Suspense, useCallback, useMemo } from "react";

import { CheckInOverlay } from "~/app/_components/check-in-overlay";
import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { KickoffDurationChips } from "~/app/_components/kickoff-duration-chips";
import { KickoffReadinessOverlay } from "~/app/_components/kickoff-readiness-overlay";
import { MidCycleCompletionPrompt } from "~/app/_components/mid-cycle-completion-prompt";
import { TabReturnCatchUp } from "~/app/_components/tab-return-catchup";
import { TaskList } from "~/app/_components/task-list";
import { TaskSuggestionCard } from "~/app/_components/task-suggestion-card";
import { TimerPanel } from "~/app/_components/timer-panel";
import { WindDownOverlay } from "~/app/_components/wind-down-overlay";
import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useE2eExposeCycleRecovery } from "~/hooks/use-e2e-expose-cycle-recovery";
import { useOnboarding } from "~/hooks/use-onboarding-state";
import { usePomodoroCycle } from "~/hooks/use-pomodoro-cycle";
import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { useGuestDomainTasks } from "~/lib/data-mode/use-domain-tasks";
import {
	CHECK_IN_COACH_LINE,
	SUGGESTION_COACH_LINE,
} from "~/lib/onboarding/copy";
import type { OnboardingScope } from "~/lib/onboarding/types";
import { api } from "~/trpc/react";

export function PomodoroDashboardBody({
	tasks,
	refreshTasks,
	enableCheckInGate = false,
	enableWindDownGate = false,
	enableSuggestionGate = false,
	checkInCoachLine,
	suggestionCoachLine,
	workTypeDurationScope,
	cycleEndAudioMode,
	setCycleEndAudioMode,
	onCheckInCoachSeen,
	onSuggestionCoachSeen,
}: {
	tasks: ReturnType<typeof useGuestDomainTasks>["tasks"];
	refreshTasks: () => Promise<void>;
	enableCheckInGate?: boolean;
	enableWindDownGate?: boolean;
	enableSuggestionGate?: boolean;
	checkInCoachLine?: string;
	suggestionCoachLine?: string;
	workTypeDurationScope?: OnboardingScope;
	cycleEndAudioMode: CycleEndAudioMode;
	setCycleEndAudioMode: (mode: CycleEndAudioMode) => void;
	onCheckInCoachSeen?: () => void;
	onSuggestionCoachSeen?: () => void;
}) {
	const getCycleEndAudioMode = useCallback(
		() => cycleEndAudioMode,
		[cycleEndAudioMode],
	);
	const pomodoro = usePomodoroCycle({ getCycleEndAudioMode });
	useE2eExposeCycleRecovery();

	const activeTaskIds = useMemo(
		() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
		[tasks],
	);

	const canMarkTaskDone =
		pomodoro.focusedTaskId != null && activeTaskIds.has(pomodoro.focusedTaskId);

	const midCycleOtherActiveTasks = useMemo(() => {
		if (pomodoro.midCyclePendingTask == null) {
			return [];
		}
		return tasks.filter(
			(t) => t.status === "active" && t.id !== pomodoro.midCyclePendingTask?.id,
		);
	}, [tasks, pomodoro.midCyclePendingTask]);

	const showTimer =
		pomodoro.focusedTask != null ||
		pomodoro.state === "running" ||
		pomodoro.state === "completed";

	const isBreakRunning =
		pomodoro.state === "running" &&
		(pomodoro.cycleKind === "SHORT_BREAK" ||
			pomodoro.cycleKind === "LONG_BREAK");

	const showSuggestionCard =
		enableSuggestionGate &&
		!pomodoro.awaitingWindDown &&
		isBreakRunning &&
		pomodoro.pendingSuggestion.status !== "idle";

	const showKickoffCard =
		enableSuggestionGate &&
		pomodoro.state === "idle" &&
		pomodoro.focusedTaskId == null &&
		pomodoro.pendingKickoffSuggestion.status !== "idle" &&
		!showSuggestionCard;

	const highlightedTaskId = showKickoffCard
		? pomodoro.kickoffSuggestedTaskId
		: showSuggestionCard
			? pomodoro.suggestedTaskId
			: null;

	const showKickoffDurationChips =
		enableSuggestionGate &&
		pomodoro.hasPreFocusedKickoff &&
		pomodoro.state === "idle" &&
		pomodoro.focusedTask != null &&
		pomodoro.pendingKickoffSuggestion.status === "ready" &&
		workTypeDurationScope != null;

	const kickoffWorkType =
		pomodoro.pendingKickoffSuggestion.status === "ready"
			? pomodoro.pendingKickoffSuggestion.data.workType
			: null;

	const catchUp = pomodoro.catchUp;

	const showCycleCompleteCatchUp =
		catchUp != null &&
		pomodoro.state === "completed" &&
		!pomodoro.awaitingCheckIn &&
		!pomodoro.awaitingWindDown &&
		!pomodoro.isPostCheckInTransitioning &&
		(catchUp.gate === "WORK_CONFIRM" || catchUp.gate === "BREAK_CONFIRM");

	const showCheckInCatchUp =
		enableCheckInGate &&
		catchUp?.gate === "CHECK_IN" &&
		pomodoro.awaitingCheckIn &&
		pomodoro.activeCycle != null;

	const showSuggestionCatchUp =
		enableSuggestionGate &&
		catchUp?.gate === "SUGGESTION_ACCEPT" &&
		pomodoro.pendingSuggestion.status === "ready";

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

			{showKickoffDurationChips &&
				kickoffWorkType != null &&
				workTypeDurationScope != null && (
					<KickoffDurationChips
						onSelect={(sec) => {
							pomodoro.selectKickoffDuration(
								kickoffWorkType,
								sec,
								workTypeDurationScope,
							);
						}}
						scope={workTypeDurationScope}
						selectedSec={pomodoro.stagedKickoffDurationSec ?? undefined}
						workType={kickoffWorkType}
					/>
				)}

			{showTimer && (
				<TimerPanel
					cycleEndAudioMode={cycleEndAudioMode}
					cycleKind={pomodoro.cycleKind}
					focusedTask={pomodoro.focusedTask}
					isStarting={false}
					onCycleEndAudioModeChange={setCycleEndAudioMode}
					onInterrupt={pomodoro.interrupt}
					onStart={pomodoro.start}
					onWorkDurationManualChange={pomodoro.clearStagedKickoffDuration}
					preferredWorkDurationSec={pomodoro.stagedKickoffDurationSec}
					remainingMs={pomodoro.remainingMs}
					state={pomodoro.state}
				/>
			)}

			{showSuggestionCard &&
				(pomodoro.pendingSuggestion.status === "loading" ? (
					<TaskSuggestionCard status="loading" />
				) : pomodoro.pendingSuggestion.status === "ready" ? (
					<div className="w-full max-w-lg">
						{showSuggestionCatchUp && catchUp != null && (
							<TabReturnCatchUp
								catchUp={catchUp}
								cycleKind={pomodoro.cycleKind}
								taskTitle={pomodoro.focusedTask?.title}
							/>
						)}
						<TaskSuggestionCard
							coachLine={suggestionCoachLine}
							isAccepting={pomodoro.isAcceptingSuggestion}
							onAccept={() => {
								pomodoro.dismissCatchUp();
								onSuggestionCoachSeen?.();
								void pomodoro.acceptSuggestion();
							}}
							status="ready"
							suggestion={{
								taskId: Number(pomodoro.pendingSuggestion.data.taskId),
								title: pomodoro.pendingSuggestion.data.title,
								workType: pomodoro.pendingSuggestion.data.workType,
								weight: pomodoro.pendingSuggestion.data.weight,
								rationale: pomodoro.pendingSuggestion.data.rationale,
								breakdown: pomodoro.pendingSuggestion.data.breakdown,
							}}
						/>
					</div>
				) : pomodoro.pendingSuggestion.status === "empty" ? (
					<TaskSuggestionCard status="empty" />
				) : pomodoro.pendingSuggestion.status === "error" ? (
					<TaskSuggestionCard
						onRetry={pomodoro.retrySuggestion}
						status="error"
					/>
				) : null)}

			{showKickoffCard &&
				(pomodoro.pendingKickoffSuggestion.status === "loading" ? (
					<TaskSuggestionCard status="loading" />
				) : pomodoro.pendingKickoffSuggestion.status === "ready" ? (
					<TaskSuggestionCard
						coachLine={suggestionCoachLine}
						isAccepting={pomodoro.isAcceptingKickoffSuggestion}
						onAccept={() => {
							onSuggestionCoachSeen?.();
							void pomodoro.acceptKickoffSuggestion();
						}}
						status="ready"
						suggestion={{
							taskId: Number(pomodoro.pendingKickoffSuggestion.data.taskId),
							title: pomodoro.pendingKickoffSuggestion.data.title,
							workType: pomodoro.pendingKickoffSuggestion.data.workType,
							weight: pomodoro.pendingKickoffSuggestion.data.weight,
							rationale: pomodoro.pendingKickoffSuggestion.data.rationale,
							breakdown: pomodoro.pendingKickoffSuggestion.data.breakdown,
						}}
					/>
				) : pomodoro.pendingKickoffSuggestion.status === "empty" ? (
					<TaskSuggestionCard status="empty" />
				) : pomodoro.pendingKickoffSuggestion.status === "error" ? (
					<TaskSuggestionCard
						onRetry={pomodoro.retryKickoffSuggestion}
						status="error"
					/>
				) : null)}

			{pomodoro.overrideAcknowledgement != null && (
				<p
					className="w-full max-w-lg rounded-lg border border-purple-400/30 bg-purple-500/10 px-4 py-3 text-center text-purple-100/90 text-sm"
					data-testid="suggestion-override-ack"
				>
					{pomodoro.overrideAcknowledgement}
				</p>
			)}

			<TaskList
				cycleKind={pomodoro.cycleKind}
				cycleState={pomodoro.state}
				focusedTaskId={pomodoro.focusedTaskId}
				highlightedTaskId={highlightedTaskId}
				onFocusTask={(taskId, task) => {
					pomodoro.selectTask(taskId, task);
				}}
				onMidCycleMarkComplete={(taskId, task) => {
					pomodoro.onMidCycleMarkComplete(taskId, task);
				}}
				onRefresh={refreshTasks}
				suggestionLoading={
					pomodoro.pendingSuggestion.status === "loading" ||
					pomodoro.pendingKickoffSuggestion.status === "loading"
				}
				tasks={tasks}
			/>

			{pomodoro.midCyclePendingTask != null && (
				<MidCycleCompletionPrompt
					isSubmitting={pomodoro.isMidCycleSubmitting}
					onContinueWithTask={async (taskId) => {
						const nextTask = tasks.find((t) => t.id === taskId);
						await pomodoro.onMidCycleContinueWithTask(taskId, nextTask ?? null);
					}}
					onEndCycleAndBreak={pomodoro.onMidCycleEndCycleAndBreak}
					otherActiveTasks={midCycleOtherActiveTasks}
					pendingTask={pomodoro.midCyclePendingTask}
				/>
			)}

			{showCycleCompleteCatchUp && catchUp != null && (
				<div className="fixed inset-x-0 top-4 z-[55] flex justify-center px-4">
					<div className="w-full max-w-md shadow-xl">
						<TabReturnCatchUp
							catchUp={catchUp}
							cycleKind={pomodoro.cycleKind}
							taskTitle={pomodoro.focusedTask?.title}
						/>
					</div>
				</div>
			)}

			{!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
					<CycleCompleteOverlay
						canMarkTaskDone={canMarkTaskDone}
						cycleKind={pomodoro.cycleKind}
						focusedTask={pomodoro.focusedTask}
						isConfirming={pomodoro.isConfirming}
						onConfirm={async (markTaskDone) => {
							pomodoro.dismissCatchUp();
							await pomodoro.onCycleCompleteConfirm(markTaskDone);
						}}
						onDismissPreFocus={pomodoro.dismissPreFocus}
						preFocusedTask={pomodoro.preFocusedTask}
						state={pomodoro.state}
					/>
				)}

			{enableSuggestionGate &&
				pomodoro.awaitingKickoffReadiness &&
				!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
					<KickoffReadinessOverlay
						isSubmitting={pomodoro.kickoffReadinessSubmitting}
						onSkip={pomodoro.skipKickoffReadiness}
						onSubmit={pomodoro.submitKickoffReadiness}
					/>
				)}

			{enableCheckInGate &&
				pomodoro.awaitingCheckIn &&
				pomodoro.activeCycle != null && (
					<>
						{showCheckInCatchUp && catchUp != null && (
							<div className="fixed inset-x-0 top-4 z-[65] flex justify-center px-4">
								<div className="w-full max-w-md shadow-xl">
									<TabReturnCatchUp
										catchUp={catchUp}
										cycleKind={pomodoro.cycleKind}
										taskTitle={pomodoro.focusedTask?.title}
									/>
								</div>
							</div>
						)}
						<CheckInOverlay
							coachLine={checkInCoachLine}
							cycleId={Number(pomodoro.activeCycle.id)}
							isSubmitting={pomodoro.isConfirming}
							onSubmit={async (energy) => {
								pomodoro.dismissCatchUp();
								onCheckInCoachSeen?.();
								await pomodoro.submitCheckIn(energy);
							}}
						/>
					</>
				)}

			{enableWindDownGate &&
				pomodoro.awaitingWindDown &&
				pomodoro.windDownRationale != null && (
					<WindDownOverlay
						isSubmitting={pomodoro.isConfirming}
						onEndSession={() => void pomodoro.onWindDownEndSession()}
						onKeepGoing={() => void pomodoro.onWindDownKeepGoing()}
						rationale={pomodoro.windDownRationale}
					/>
				)}

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
	const {
		scope: onboardingScope,
		shouldShowCheckInCoach,
		shouldShowSuggestionCoach,
		markCheckInCoachSeen,
		markSuggestionCoachSeen,
	} = useOnboarding();

	const domainTasks = useMemo(
		() =>
			tasks.map((t) => ({
				...t,
				weight: t.weight as 1 | 2 | 3,
				importance: t.importance as 1 | 2 | 3,
				urgency: t.urgency as 1 | 2 | 3,
			})),
		[tasks],
	);

	const workTypeDurationScope =
		onboardingScope.mode === "authenticated" ? onboardingScope : undefined;

	const { mode: cycleEndAudioMode, setMode: setCycleEndAudioMode } =
		useCycleEndAudioPreference(onboardingScope);

	return (
		<PomodoroDashboardBody
			checkInCoachLine={
				shouldShowCheckInCoach ? CHECK_IN_COACH_LINE : undefined
			}
			cycleEndAudioMode={cycleEndAudioMode}
			enableCheckInGate
			enableSuggestionGate
			enableWindDownGate
			onCheckInCoachSeen={markCheckInCoachSeen}
			onSuggestionCoachSeen={markSuggestionCoachSeen}
			refreshTasks={async () => {
				await utils.task.list.invalidate();
			}}
			setCycleEndAudioMode={setCycleEndAudioMode}
			suggestionCoachLine={
				shouldShowSuggestionCoach ? SUGGESTION_COACH_LINE : undefined
			}
			tasks={domainTasks}
			workTypeDurationScope={workTypeDurationScope}
		/>
	);
}

function GuestPomodoroDashboard() {
	const { tasks, refresh } = useGuestDomainTasks();
	const guestScope = useMemo(() => ({ mode: "guest" as const }), []);
	const { mode: cycleEndAudioMode, setMode: setCycleEndAudioMode } =
		useCycleEndAudioPreference(guestScope);

	return (
		<PomodoroDashboardBody
			cycleEndAudioMode={cycleEndAudioMode}
			refreshTasks={refresh}
			setCycleEndAudioMode={setCycleEndAudioMode}
			tasks={tasks}
		/>
	);
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
