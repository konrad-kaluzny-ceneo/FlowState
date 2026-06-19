"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { CheckInOverlay } from "~/app/_components/check-in-overlay";
import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { CycleIntentionPrompt } from "~/app/_components/cycle-intention-prompt";
import { FocusBudgetPrompt } from "~/app/_components/focus-budget-prompt";
import { KickoffDurationChips } from "~/app/_components/kickoff-duration-chips";
import { KickoffReadinessOverlay } from "~/app/_components/kickoff-readiness-overlay";
import { MidCycleCompletionPrompt } from "~/app/_components/mid-cycle-completion-prompt";
import { SessionClosureOverlay } from "~/app/_components/session-closure-overlay";
import { TabReturnCatchUp } from "~/app/_components/tab-return-catchup";
import { TaskList } from "~/app/_components/task-list";
import { TaskSuggestionCard } from "~/app/_components/task-suggestion-card";
import { TimerPanel } from "~/app/_components/timer-panel";
import { WindDownOverlay } from "~/app/_components/wind-down-overlay";
import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useDayPlan } from "~/hooks/use-day-plan";
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
import { resolveWedgeBeat } from "~/lib/wedge/transition-conductor";
import { api } from "~/trpc/react";

type DayPlanView = ReturnType<typeof useDayPlan>;

export function PomodoroDashboardBody({
	tasks,
	refreshTasks,
	dayPlan,
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
	dayPlan?: DayPlanView;
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
		pomodoro.state === "paused" ||
		pomodoro.state === "completed";

	const isBreakRunning =
		pomodoro.state === "running" &&
		(pomodoro.cycleKind === "SHORT_BREAK" ||
			pomodoro.cycleKind === "LONG_BREAK");

	const cyclePaused = pomodoro.state === "paused";

	const showSuggestionCard =
		enableSuggestionGate &&
		!cyclePaused &&
		!pomodoro.awaitingWindDown &&
		isBreakRunning &&
		pomodoro.pendingSuggestion.status !== "idle";

	const showKickoffCard =
		enableSuggestionGate &&
		!cyclePaused &&
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
		!cyclePaused &&
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

	const wedgeBeat = useMemo(
		() =>
			resolveWedgeBeat({
				enableCheckInGate,
				enableWindDownGate,
				enableSuggestionGate,
				pendingClosureLine: pomodoro.pendingClosureLine,
				awaitingCheckIn: pomodoro.awaitingCheckIn,
				awaitingWindDown: pomodoro.awaitingWindDown,
				windDownRationale: pomodoro.windDownRationale,
				awaitingKickoffReadiness: pomodoro.awaitingKickoffReadiness,
				awaitingCycleIntention: pomodoro.awaitingCycleIntention,
				isPostCheckInTransitioning: pomodoro.isPostCheckInTransitioning,
				activeCycle: pomodoro.activeCycle,
				returnHandoffGateOpen: pomodoro.returnHandoffGateOpen,
				cyclePaused,
				state: pomodoro.state,
			}),
		[
			enableCheckInGate,
			enableWindDownGate,
			enableSuggestionGate,
			pomodoro.pendingClosureLine,
			pomodoro.awaitingCheckIn,
			pomodoro.awaitingWindDown,
			pomodoro.windDownRationale,
			pomodoro.awaitingKickoffReadiness,
			pomodoro.awaitingCycleIntention,
			pomodoro.isPostCheckInTransitioning,
			pomodoro.activeCycle,
			pomodoro.returnHandoffGateOpen,
			pomodoro.state,
			cyclePaused,
		],
	);

	const wedgeGateActive = wedgeBeat.activeGate !== "none";

	const showCycleCompleteCatchUp =
		!cyclePaused &&
		catchUp != null &&
		pomodoro.state === "completed" &&
		!pomodoro.awaitingCheckIn &&
		!pomodoro.awaitingWindDown &&
		!pomodoro.isPostCheckInTransitioning &&
		(catchUp.gate === "WORK_CONFIRM" || catchUp.gate === "BREAK_CONFIRM");

	const showCheckInCatchUp =
		!cyclePaused &&
		enableCheckInGate &&
		catchUp?.gate === "CHECK_IN" &&
		pomodoro.awaitingCheckIn &&
		pomodoro.activeCycle != null;

	const showSuggestionCatchUp =
		!cyclePaused &&
		enableSuggestionGate &&
		catchUp?.gate === "SUGGESTION_ACCEPT" &&
		pomodoro.pendingSuggestion.status === "ready";

	const showInFlowSummary =
		!cyclePaused &&
		pomodoro.inFlowSummaryLine != null &&
		!wedgeGateActive &&
		!showSuggestionCard &&
		!showKickoffCard &&
		!pomodoro.awaitingCycleIntention;

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
						className="ml-3 underline hover:text-primary"
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
					onPause={pomodoro.pause}
					onResume={pomodoro.resume}
					onStart={pomodoro.start}
					onWorkDurationManualChange={pomodoro.clearStagedKickoffDuration}
					preferredWorkDurationSec={pomodoro.stagedKickoffDurationSec}
					remainingMs={pomodoro.remainingMs}
					state={pomodoro.state}
				/>
			)}

			{showInFlowSummary && (
				<p
					className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-2 text-center text-sm text-text-secondary"
					data-testid="session-inflow-summary"
				>
					{pomodoro.inFlowSummaryLine}
				</p>
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
								urgency: pomodoro.pendingSuggestion.data.urgency,
								importance: pomodoro.pendingSuggestion.data.importance,
								commitmentHorizon:
									pomodoro.pendingSuggestion.data.commitmentHorizon,
								rationale: pomodoro.pendingSuggestion.data.rationale,
								breakdown: pomodoro.pendingSuggestion.data.breakdown,
								resumeNote: pomodoro.pendingSuggestion.data.resumeNote,
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
							urgency: pomodoro.pendingKickoffSuggestion.data.urgency,
							importance: pomodoro.pendingKickoffSuggestion.data.importance,
							commitmentHorizon:
								pomodoro.pendingKickoffSuggestion.data.commitmentHorizon,
							rationale: pomodoro.pendingKickoffSuggestion.data.rationale,
							breakdown: pomodoro.pendingKickoffSuggestion.data.breakdown,
							resumeNote: pomodoro.pendingKickoffSuggestion.data.resumeNote,
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

			{dayPlan != null && (
				<FocusBudgetPrompt
					hasBudget={dayPlan.hasBudget}
					isLoading={dayPlan.isLoading}
					isSettingBudget={dayPlan.isSettingBudget}
					localDateKey={dayPlan.localDateKey}
					onSetBudget={dayPlan.setBudget}
				/>
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
					onContinueWithTask={async (taskId, resumeNote) => {
						const nextTask = tasks.find((t) => t.id === taskId);
						await pomodoro.onMidCycleContinueWithTask(
							taskId,
							nextTask ?? null,
							resumeNote,
						);
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

			{wedgeBeat.showCycleComplete && (
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

			{wedgeBeat.showKickoffReadiness && (
				<KickoffReadinessOverlay
					isSubmitting={pomodoro.kickoffReadinessSubmitting}
					onSkip={pomodoro.skipKickoffReadiness}
					onSubmit={pomodoro.submitKickoffReadiness}
				/>
			)}

			{wedgeBeat.showCycleIntention && (
				<CycleIntentionPrompt
					onSkip={pomodoro.skipCycleIntention}
					onSubmit={pomodoro.submitCycleIntention}
				/>
			)}

			{wedgeBeat.showSessionClosure && pomodoro.pendingClosureLine != null && (
				<SessionClosureOverlay
					closureLine={pomodoro.pendingClosureLine}
					onDismiss={pomodoro.dismissSessionClosure}
				/>
			)}

			{wedgeBeat.showCheckIn && pomodoro.activeCycle != null && (
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

			{wedgeBeat.showWindDown && pomodoro.windDownRationale != null && (
				<WindDownOverlay
					isSubmitting={pomodoro.isConfirming}
					onEndSession={() => void pomodoro.onWindDownEndSession()}
					onKeepGoing={() => void pomodoro.onWindDownKeepGoing()}
					rationale={pomodoro.windDownRationale}
				/>
			)}

			{pomodoro.hasActiveSession && (
				<button
					className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition hover:border-red-400/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
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
	const dayPlan = useDayPlan();
	const [hasMounted, setHasMounted] = useState(false);
	useEffect(() => {
		setHasMounted(true);
	}, []);
	// Prefetch in page.tsx uses undefined input — keep suspense key aligned for SSR.
	const [baseTasks] = api.task.list.useSuspenseQuery();
	const { data: tasksWithDayStatus = baseTasks } = api.task.list.useQuery(
		{ localDateKey: dayPlan.localDateKey },
		{ enabled: hasMounted },
	);
	const tasks = tasksWithDayStatus;
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
			dayPlan={dayPlan}
			enableCheckInGate
			enableSuggestionGate
			enableWindDownGate
			onCheckInCoachSeen={markCheckInCoachSeen}
			onSuggestionCoachSeen={markSuggestionCoachSeen}
			refreshTasks={async () => {
				await Promise.all([
					utils.task.list.invalidate(),
					utils.task.list.invalidate({
						localDateKey: dayPlan.localDateKey,
					}),
				]);
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
				<p className="text-sm text-text-dimmed" data-testid="dashboard-loading">
					Loading tasks…
				</p>
			}
		>
			<AuthenticatedPomodoroDashboard />
		</Suspense>
	);
}
