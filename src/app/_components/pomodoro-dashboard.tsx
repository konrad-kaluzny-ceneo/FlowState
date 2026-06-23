"use client";

import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { BreakAlertsPermissionPrompt } from "~/app/_components/break-alerts-permission-prompt";
import { CheckInOverlay } from "~/app/_components/check-in-overlay";
import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { DailyRecapPanel } from "~/app/_components/daily-recap-panel";
import { EndSessionConfirmOverlay } from "~/app/_components/end-session-confirm-overlay";
import { FocusBudgetPrompt } from "~/app/_components/focus-budget-prompt";
import { KickoffDurationChips } from "~/app/_components/kickoff-duration-chips";
import { MidCycleCompletionPrompt } from "~/app/_components/mid-cycle-completion-prompt";
import { SessionClosureOverlay } from "~/app/_components/session-closure-overlay";
import {
	SessionEnergyCard,
	SessionFocusCard,
} from "~/app/_components/session-steering-card";
import { TabReturnCatchUp } from "~/app/_components/tab-return-catchup";
import { TaskList } from "~/app/_components/task-list";
import { TaskSuggestionCard } from "~/app/_components/task-suggestion-card";
import { TimerPanel } from "~/app/_components/timer-panel";
import { WedgeSyncRecovery } from "~/app/_components/wedge-sync-recovery";
import { WindDownOverlay } from "~/app/_components/wind-down-overlay";
import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useDailyRecap } from "~/hooks/use-daily-recap";
import { useDayPlan } from "~/hooks/use-day-plan";
import { useE2eExposeCycleRecovery } from "~/hooks/use-e2e-expose-cycle-recovery";
import { useOnboarding } from "~/hooks/use-onboarding-state";
import { useOutOfTabBreakAlertsPreference } from "~/hooks/use-out-of-tab-break-alerts-preference";
import { usePomodoroCycle } from "~/hooks/use-pomodoro-cycle";
import { useSyncBreakAtmosphere } from "~/hooks/use-sync-break-atmosphere";
import { useSyncWorkFocusShell } from "~/hooks/use-sync-work-focus-shell";
import { getNotificationPermission } from "~/lib/break-out-of-tab-alert/notify-break-start";
import {
	readNotificationPromptDismissed,
	writeNotificationPromptDismissed,
} from "~/lib/break-out-of-tab-alert/storage";
import type { CycleEndAudioMode } from "~/lib/cycle-audio-preference/types";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import {
	useDomainTasks,
	useGuestDomainTasks,
} from "~/lib/data-mode/use-domain-tasks";
import { shouldShowBreakAtmosphere } from "~/lib/design/break-atmosphere";
import { shouldShowWorkFocusShell } from "~/lib/design/work-focus-shell";
import { shouldDeferFirstRun } from "~/lib/onboarding/defer";
import {
	resolveCheckInCoachLine,
	resolveSuggestionCoachLine,
} from "~/lib/onboarding/post-merge-wedge-coach";
import type { OnboardingScope, OnboardingState } from "~/lib/onboarding/types";
import { getBreakReentryLine } from "~/lib/session/transition-copy";
import { getPersonaPresetLabel } from "~/lib/task/persona-presets";
import { resolveWedgeBeat } from "~/lib/wedge/transition-conductor";

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
	onboardingState,
	shouldShowCheckInCoach: shouldShowCheckInCoachFlag,
	shouldShowSuggestionCoach: shouldShowSuggestionCoachFlag,
	workTypeDurationScope,
	cycleEndAudioMode,
	setCycleEndAudioMode,
	onboardingScope = { mode: "guest" },
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
	onboardingState?: OnboardingState;
	shouldShowCheckInCoach?: boolean;
	shouldShowSuggestionCoach?: boolean;
	workTypeDurationScope?: OnboardingScope;
	cycleEndAudioMode: CycleEndAudioMode;
	setCycleEndAudioMode: (mode: CycleEndAudioMode) => void;
	onboardingScope?: OnboardingScope;
	onCheckInCoachSeen?: () => void;
	onSuggestionCoachSeen?: () => void;
}) {
	const {
		enabled: outOfTabBreakAlertsEnabled,
		setEnabled: setOutOfTabBreakAlertsEnabled,
	} = useOutOfTabBreakAlertsPreference(onboardingScope);

	const getCycleEndAudioMode = useCallback(
		() => cycleEndAudioMode,
		[cycleEndAudioMode],
	);
	const getOutOfTabBreakAlertsEnabled = useCallback(
		() => outOfTabBreakAlertsEnabled,
		[outOfTabBreakAlertsEnabled],
	);
	const activeTaskIds = useMemo(
		() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
		[tasks],
	);
	const pomodoro = usePomodoroCycle({
		getCycleEndAudioMode,
		getOutOfTabBreakAlertsEnabled,
		activeTaskIds,
		continueTasks: tasks.map((task) => ({
			id: task.id,
			status: task.status,
		})),
	});
	useE2eExposeCycleRecovery();
	const {
		recap,
		isLoading: recapLoading,
		localDateKey: recapDateKey,
	} = useDailyRecap();

	const suggestionPersonaLabel = useMemo(() => {
		const pending = pomodoro.pendingSuggestion;
		if (pending.status !== "ready") {
			return null;
		}
		const task = tasks.find((t) => t.id === pending.data.taskId);
		if (task?.personaPresetId == null || task.personaPresetId === "custom") {
			return null;
		}
		return getPersonaPresetLabel(task.personaPresetId) ?? null;
	}, [pomodoro.pendingSuggestion, tasks]);

	const effectiveCheckInCoachLine =
		onboardingState != null && shouldShowCheckInCoachFlag != null
			? resolveCheckInCoachLine(onboardingState, shouldShowCheckInCoachFlag)
			: checkInCoachLine;

	const effectiveSuggestionCoachLine =
		onboardingState != null && shouldShowSuggestionCoachFlag != null
			? resolveSuggestionCoachLine(
					onboardingState,
					shouldShowSuggestionCoachFlag,
					suggestionPersonaLabel,
				)
			: suggestionCoachLine;

	type PendingStartAction = { kind: "start"; durationSec: number };

	const steeringCompletedRef = useRef(false);
	const [permissionPromptVisible, setPermissionPromptVisible] = useState(false);
	const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
	const [isEndingSession, setIsEndingSession] = useState(false);
	const [pendingStartAction, setPendingStartAction] =
		useState<PendingStartAction | null>(null);

	const needsPermissionPrompt = useCallback(() => {
		if (typeof window === "undefined" || shouldDeferFirstRun()) {
			return false;
		}

		if (readNotificationPromptDismissed(onboardingScope)) {
			return false;
		}

		return getNotificationPermission() === "default";
	}, [onboardingScope]);

	const completePendingStart = useCallback(async () => {
		const pending = pendingStartAction;
		setPendingStartAction(null);
		setPermissionPromptVisible(false);

		if (pending == null) {
			return;
		}

		await pomodoro.start(pending.durationSec);
	}, [pendingStartAction, pomodoro]);

	const handleStartWithPermission = useCallback(
		async (durationSec: number) => {
			if (needsPermissionPrompt() && steeringCompletedRef.current) {
				setPendingStartAction({ kind: "start", durationSec });
				setPermissionPromptVisible(true);
				return;
			}

			await pomodoro.start(durationSec);
		},
		[needsPermissionPrompt, pomodoro],
	);

	const handleCompleteEnergy = useCallback(
		(energy: "FOCUSED" | "STEADY" | "FADING") => {
			steeringCompletedRef.current = true;
			pomodoro.completeSessionEnergy(energy);
		},
		[pomodoro],
	);

	const handleSkipEnergy = useCallback(() => {
		steeringCompletedRef.current = true;
		pomodoro.skipSessionEnergy();
	}, [pomodoro]);

	const handleCompleteFocus = useCallback(
		(intention: string) => {
			steeringCompletedRef.current = true;
			pomodoro.completeSessionFocus(intention);
		},
		[pomodoro],
	);

	const handleSkipFocus = useCallback(() => {
		steeringCompletedRef.current = true;
		pomodoro.skipSessionFocus();
	}, [pomodoro]);

	const dismissPermissionPrompt = useCallback(() => {
		writeNotificationPromptDismissed(onboardingScope, true);
		setPermissionPromptVisible(false);
		void completePendingStart();
	}, [completePendingStart, onboardingScope]);

	const handleEndSessionClick = useCallback(() => {
		if (pomodoro.state === "running" || pomodoro.state === "paused") {
			setEndSessionConfirmOpen(true);
			return;
		}

		void pomodoro.endSession();
	}, [pomodoro]);

	const handleEndSessionConfirm = useCallback(async () => {
		setIsEndingSession(true);
		try {
			await pomodoro.endSession();
			setEndSessionConfirmOpen(false);
		} finally {
			setIsEndingSession(false);
		}
	}, [pomodoro]);

	const handleEndSessionCancel = useCallback(() => {
		setEndSessionConfirmOpen(false);
	}, []);

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
		!showSuggestionCard &&
		!pomodoro.showSessionEnergy &&
		!pomodoro.showSessionFocus;

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
				isPostCheckInTransitioning: pomodoro.isPostCheckInTransitioning,
				activeCycle: pomodoro.activeCycle,
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
			pomodoro.isPostCheckInTransitioning,
			pomodoro.activeCycle,
			pomodoro.state,
			cyclePaused,
		],
	);

	const wedgeGateActive = wedgeBeat.activeGate !== "none";

	const breakAtmosphereActive = shouldShowBreakAtmosphere({
		cycleKind: pomodoro.cycleKind,
		state: pomodoro.state,
		wedgeGateActive,
		suggestionCardOnBreak: showSuggestionCard,
	});
	useSyncBreakAtmosphere(breakAtmosphereActive);

	const workFocusShellActive = shouldShowWorkFocusShell({
		cycleKind: pomodoro.cycleKind,
		state: pomodoro.state,
		wedgeGateActive,
	});
	useSyncWorkFocusShell(workFocusShellActive);

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
		!showSuggestionCard;

	const showBreakTransitionLine =
		!cyclePaused &&
		isBreakRunning &&
		pomodoro.breakTransitionLine != null &&
		!wedgeGateActive &&
		!showSuggestionCard &&
		!showInFlowSummary;

	const breakReentryCopy =
		pomodoro.cycleKind === "SHORT_BREAK" || pomodoro.cycleKind === "LONG_BREAK"
			? getBreakReentryLine(pomodoro.narrativeLatestEnergy)
			: null;

	return (
		<div className="flex w-full max-w-lg flex-col items-center gap-8">
			{pomodoro.pendingWedgeRecovery != null ? (
				<WedgeSyncRecovery
					isRetrying={pomodoro.isWedgeSyncRetrying || pomodoro.isConfirming}
					onDismiss={pomodoro.dismissPendingWedgeRecovery}
					onRetry={() => {
						void pomodoro.retryWedgeSync();
					}}
					recovery={pomodoro.pendingWedgeRecovery}
				/>
			) : (
				pomodoro.error != null && (
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
				)
			)}

			{enableSuggestionGate && pomodoro.showSessionEnergy && (
				<SessionEnergyCard
					disabled={pomodoro.sessionSteeringSubmitting}
					onSelect={handleCompleteEnergy}
					onSkip={handleSkipEnergy}
				/>
			)}

			{enableSuggestionGate && pomodoro.showSessionFocus && (
				<SessionFocusCard
					isSubmitting={pomodoro.sessionSteeringSubmitting}
					onComplete={handleCompleteFocus}
					onSkip={handleSkipFocus}
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

			{showBreakTransitionLine && (
				<button
					className="w-full max-w-lg rounded-lg border border-energy-steady-border bg-energy-steady-bg px-4 py-3 text-center text-sm text-text-secondary"
					data-testid="break-transition-line"
					onClick={pomodoro.clearBreakTransitionLine}
					type="button"
				>
					{pomodoro.breakTransitionLine}
				</button>
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
					onOutOfTabBreakAlertsChange={setOutOfTabBreakAlertsEnabled}
					onPause={pomodoro.pause}
					onResume={pomodoro.resume}
					onStart={handleStartWithPermission}
					onWorkDurationManualChange={pomodoro.clearStagedKickoffDuration}
					outOfTabBreakAlertsEnabled={outOfTabBreakAlertsEnabled}
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
							coachLine={effectiveSuggestionCoachLine}
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
						coachLine={effectiveSuggestionCoachLine}
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
					className="w-full max-w-lg rounded-lg border border-energy-steady-border bg-energy-steady-bg px-4 py-3 text-center text-sm text-text-secondary"
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

			<DailyRecapPanel
				isLoading={recapLoading}
				localDateKey={recapDateKey}
				recap={recap}
			/>

			<TaskList
				chromeSubdued={breakAtmosphereActive}
				continueTaskId={pomodoro.continueTaskId}
				cycleKind={pomodoro.cycleKind}
				cycleState={pomodoro.state}
				focusedTaskId={pomodoro.focusedTaskId}
				focusShellActive={workFocusShellActive}
				footprints={recap.footprints}
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
					reentryCopy={breakReentryCopy}
					state={pomodoro.state}
				/>
			)}

			<BreakAlertsPermissionPrompt
				onDismiss={dismissPermissionPrompt}
				onEnable={dismissPermissionPrompt}
				visible={permissionPromptVisible}
			/>

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
						coachLine={effectiveCheckInCoachLine}
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

			{endSessionConfirmOpen && (
				<EndSessionConfirmOverlay
					isSubmitting={isEndingSession}
					onCancel={handleEndSessionCancel}
					onConfirm={() => void handleEndSessionConfirm()}
				/>
			)}

			{pomodoro.hasActiveSession && (
				<button
					className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition hover:border-red-400/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
					data-testid="end-session-btn"
					disabled={pomodoro.isConfirming || isEndingSession}
					onClick={handleEndSessionClick}
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
	const { tasks: domainTasks, refresh: refreshTasks } = useDomainTasks(
		"authenticated",
		{
			localDateKey: dayPlan.localDateKey,
			hasMounted,
		},
	);
	const {
		scope: onboardingScope,
		state: onboardingState,
		shouldShowCheckInCoach,
		shouldShowSuggestionCoach,
		markCheckInCoachSeen,
		markSuggestionCoachSeen,
	} = useOnboarding();

	const workTypeDurationScope =
		onboardingScope.mode === "authenticated" ? onboardingScope : undefined;

	const { mode: cycleEndAudioMode, setMode: setCycleEndAudioMode } =
		useCycleEndAudioPreference(onboardingScope);

	return (
		<PomodoroDashboardBody
			cycleEndAudioMode={cycleEndAudioMode}
			dayPlan={dayPlan}
			enableCheckInGate
			enableSuggestionGate
			enableWindDownGate
			onboardingScope={onboardingScope}
			onboardingState={onboardingState}
			onCheckInCoachSeen={markCheckInCoachSeen}
			onSuggestionCoachSeen={markSuggestionCoachSeen}
			refreshTasks={refreshTasks}
			setCycleEndAudioMode={setCycleEndAudioMode}
			shouldShowCheckInCoach={shouldShowCheckInCoach}
			shouldShowSuggestionCoach={shouldShowSuggestionCoach}
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
			onboardingScope={guestScope}
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
