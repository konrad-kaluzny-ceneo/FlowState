"use client";

import { useLocale, useTranslations } from "next-intl";
import {
	type ReactNode,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";

import { AddTaskModal } from "~/app/_components/add-task-modal";
import { BreakAlertsPermissionPrompt } from "~/app/_components/break-alerts-permission-prompt";
import { CheckInOverlay } from "~/app/_components/check-in-overlay";
import { CycleCompleteOverlay } from "~/app/_components/cycle-complete-overlay";
import { DailyRecapPanel } from "~/app/_components/daily-recap-panel";
import { DayMemoryLine } from "~/app/_components/day-memory-line";
import { useDayStartGateDismissed } from "~/app/_components/day-start-gate";
import { EndSessionConfirmOverlay } from "~/app/_components/end-session-confirm-overlay";
import { FocusBudgetPrompt } from "~/app/_components/focus-budget-prompt";
import { FocusEmptyState } from "~/app/_components/focus-empty-state";
import { FocusGettingStarted } from "~/app/_components/focus-getting-started";
import { FocusInfoBanner } from "~/app/_components/focus-info-banner";
import { FocusReadyState } from "~/app/_components/focus-ready-state";
import { FocusTip } from "~/app/_components/focus-tip";
import { GuestContextRail } from "~/app/_components/guest-context-rail";
import { HomeFocusSummary } from "~/app/_components/home-focus-summary";
import { KickoffDurationChips } from "~/app/_components/kickoff-duration-chips";
import { MidCycleCompletionPrompt } from "~/app/_components/mid-cycle-completion-prompt";
import { usePomodoroCycleContext } from "~/app/_components/pomodoro-cycle-provider";
import { QuickActions } from "~/app/_components/quick-actions";
import { SessionClosureOverlay } from "~/app/_components/session-closure-overlay";
import { SessionEnergyCard } from "~/app/_components/session-steering-card";
import { TabReturnCatchUp } from "~/app/_components/tab-return-catchup";
import type { TaskSuggestionData } from "~/app/_components/task-suggestion-card";
import { TimerPanel } from "~/app/_components/timer-panel";
import { WedgeSyncRecovery } from "~/app/_components/wedge-sync-recovery";
import { WindDownOverlay } from "~/app/_components/wind-down-overlay";
import { useDailyRecap } from "~/hooks/use-daily-recap";
import { useDayPlan } from "~/hooks/use-day-plan";
import { useOnboarding } from "~/hooks/use-onboarding-state";
import { useSyncBreakAtmosphere } from "~/hooks/use-sync-break-atmosphere";
import { useSyncWorkFocusShell } from "~/hooks/use-sync-work-focus-shell";
import { useTaskMutations } from "~/hooks/use-task-mutations";
import { getNotificationPermission } from "~/lib/break-out-of-tab-alert/notify-break-start";
import {
	readNotificationPromptDismissed,
	writeNotificationPromptDismissed,
} from "~/lib/break-out-of-tab-alert/storage";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import {
	useDomainTasks,
	useGuestDomainTasks,
} from "~/lib/data-mode/use-domain-tasks";
import { shouldShowBreakAtmosphere } from "~/lib/design/break-atmosphere";
import { usePublishHomeIllustrationVariant } from "~/lib/design/home-illustration-variant";
import {
	resolveIllustrationEnergyTint,
	resolveIllustrationVariant,
} from "~/lib/design/illustration-variant";
import { HomeHeroSprig } from "~/lib/design/illustrations/home-hero-sprig";
import { shouldShowWorkFocusShell } from "~/lib/design/work-focus-shell";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	deriveHomeSessionState,
	type HomeModuleKey,
	type HomeSessionState,
} from "~/lib/home/home-session-state";
import { shouldDeferFirstRun } from "~/lib/onboarding/defer";
import {
	resolveCheckInCoachLine,
	resolveSuggestionCoachLine,
} from "~/lib/onboarding/post-merge-wedge-coach";
import type { OnboardingScope, OnboardingState } from "~/lib/onboarding/types";
import { formatDayMemory } from "~/lib/recap/format-day-memory";
import { getBreakReentryLine } from "~/lib/session/transition-copy";
import { resolveWedgeBeat } from "~/lib/wedge/transition-conductor";

type DayPlanView = ReturnType<typeof useDayPlan>;

function mapSuggestionGateStatus(
	status: "idle" | "loading" | "ready" | "empty" | "error",
): "idle" | "loading" | "ready" | "error" {
	if (status === "empty") {
		return "ready";
	}
	return status;
}

type HomeLayoutRegionTestId =
	| "home-primary-region"
	| "home-secondary-region"
	| "home-context-rail";

/** Zone owns the width contract: children stay w-full and never self-cap. */
function HomeLayoutRegion({
	children,
	testId,
	className = "",
}: {
	children?: ReactNode;
	testId: HomeLayoutRegionTestId;
	className?: string;
}) {
	return (
		<div
			className={`flex w-full max-w-lg flex-col items-center gap-section lg:max-w-none${className ? ` ${className}` : ""}`}
			data-testid={testId}
		>
			{children}
		</div>
	);
}

export function PomodoroDashboardBody({
	tasks,
	refreshTasks: _refreshTasks,
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
	onboardingScope?: OnboardingScope;
	onCheckInCoachSeen?: () => void;
	onSuggestionCoachSeen?: () => void;
}) {
	const pomodoro = usePomodoroCycleContext();
	const pomodoroRef = useRef(pomodoro);
	pomodoroRef.current = pomodoro;
	const { outOfTabBreakAlertsEnabled, setOutOfTabBreakAlertsEnabled } =
		pomodoro;
	const activeTaskIds = useMemo(
		() =>
			new Set(
				tasks
					.filter((t) => t.status === "active" || t.status === "planned")
					.map((t) => t.id),
			),
		[tasks],
	);
	const {
		recap,
		isLoading: recapLoading,
		localDateKey: recapDateKey,
	} = useDailyRecap();

	// Day-start gate (S-45 p6): energy+goal steering asks once per day, then
	// stays hidden even if the cycle hook re-arms it for a later session. The
	// dismissal must mask the raw flags BEFORE they feed deriveHomeSessionState
	// below — masking only the rendered cards would leave the derived
	// "steering" session state on screen with nothing to act on (a dead-end).
	const rawSteeringVisible = pomodoro.showSessionEnergy;
	const dayStartGateDismissed = useDayStartGateDismissed(
		recapDateKey,
		rawSteeringVisible,
	);
	const showSessionEnergy =
		pomodoro.showSessionEnergy && !dayStartGateDismissed;

	const locale = useLocale() as UserLocale;
	const dataMode =
		onboardingScope.mode === "authenticated" ? "authenticated" : "guest";
	const tDashboard = useTranslations("Session.dashboard");

	const effectiveCheckInCoachLine =
		onboardingState != null && shouldShowCheckInCoachFlag != null
			? resolveCheckInCoachLine(
					onboardingState,
					shouldShowCheckInCoachFlag,
					locale,
				)
			: checkInCoachLine;

	const effectiveSuggestionCoachLine =
		onboardingState != null && shouldShowSuggestionCoachFlag != null
			? resolveSuggestionCoachLine(
					onboardingState,
					shouldShowSuggestionCoachFlag,
					null,
					locale,
				)
			: suggestionCoachLine;

	type PendingStartAction = { kind: "start"; durationSec: number };

	const steeringCompletedRef = useRef(false);
	const [permissionPromptVisible, setPermissionPromptVisible] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
	const [endSessionConfirmVariant, setEndSessionConfirmVariant] = useState<
		"immediate" | "after-pause"
	>("immediate");
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

			await pomodoroRef.current.start(durationSec);
		},
		[needsPermissionPrompt],
	);

	const handleCompleteEnergy = useCallback(
		(energy: "FOCUSED" | "STEADY" | "FADING") => {
			steeringCompletedRef.current = true;
			// Persist the choice as today's "energy of the day" (DayPlan) so it is
			// editable in settings; also steer the first kickoff suggestion. The
			// DayPlan write is best-effort — the kickoff flow must not depend on it.
			void dayPlan?.setEnergy(energy).catch(() => {});
			pomodoro.completeSessionEnergy(energy);
		},
		[dayPlan, pomodoro],
	);

	const handleSkipEnergy = useCallback(() => {
		steeringCompletedRef.current = true;
		pomodoro.skipSessionEnergy();
	}, [pomodoro]);

	const dismissPermissionPrompt = useCallback(() => {
		writeNotificationPromptDismissed(onboardingScope, true);
		setPermissionPromptVisible(false);
		void completePendingStart();
	}, [completePendingStart, onboardingScope]);

	const handleEndSessionClick = useCallback(() => {
		if (pomodoro.state === "running" || pomodoro.state === "paused") {
			setEndSessionConfirmVariant(
				pomodoro.state === "paused" ? "after-pause" : "immediate",
			);
			setEndSessionConfirmOpen(true);
			return;
		}

		void pomodoro.endSession();
	}, [pomodoro]);

	const handlePauseAndEndSessionClick = useCallback(async () => {
		if (pomodoro.state === "running") {
			await pomodoro.pause();
		}
		setEndSessionConfirmVariant("after-pause");
		setEndSessionConfirmOpen(true);
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
		setEndSessionConfirmVariant("immediate");
	}, []);

	const canMarkTaskDone =
		pomodoro.focusedTaskId != null && activeTaskIds.has(pomodoro.focusedTaskId);

	const focusedActiveTask = useMemo(() => {
		if (pomodoro.focusedTaskId == null) {
			return null;
		}
		return tasks.find((task) => task.id === pomodoro.focusedTaskId) ?? null;
	}, [pomodoro.focusedTaskId, tasks]);

	const primaryMarksDoneForToday =
		focusedActiveTask?.isDailyStanding === true &&
		focusedActiveTask.doneForToday !== true;

	const { markDoneForToday, createTask, isCreating } = useTaskMutations();

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

	// S-43: transient closure flag — set when the session_closure gate
	// transitions visible → dismissed, cleared on the next session-state
	// change (mirrors the showInFlowSummary clear-on-next-transition pattern).
	// Guarded on pendingClosureLine == null so the flag only fires for a real
	// dismissal (dismissSessionClosure clears the line) — never when the gate
	// is merely suppressed (cyclePaused / cycle recovery) with the line intact.
	const sessionClosureVisible =
		wedgeBeat.showSessionClosure && pomodoro.pendingClosureLine != null;
	const [recentlyClosedSession, setRecentlyClosedSession] = useState(false);
	const prevSessionClosureVisibleRef = useRef(false);
	useEffect(() => {
		if (
			prevSessionClosureVisibleRef.current &&
			!sessionClosureVisible &&
			pomodoro.pendingClosureLine == null
		) {
			setRecentlyClosedSession(true);
		}
		prevSessionClosureVisibleRef.current = sessionClosureVisible;
	}, [sessionClosureVisible, pomodoro.pendingClosureLine]);

	const breakAtmosphereActive = shouldShowBreakAtmosphere({
		cycleKind: pomodoro.cycleKind,
		state: pomodoro.state,
		wedgeGateActive,
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

	const showInFlowSummary =
		!cyclePaused && pomodoro.inFlowSummaryLine != null && !wedgeGateActive;

	const showBreakTransitionLine =
		!cyclePaused &&
		isBreakRunning &&
		pomodoro.breakTransitionLine != null &&
		!wedgeGateActive &&
		!showInFlowSummary;

	const breakReentryCopy =
		pomodoro.cycleKind === "SHORT_BREAK" || pomodoro.cycleKind === "LONG_BREAK"
			? getBreakReentryLine(pomodoro.narrativeLatestEnergy)
			: null;

	const homeIa = useMemo(
		() =>
			deriveHomeSessionState({
				dataMode,
				cycleKind: pomodoro.cycleKind,
				cycleState: pomodoro.state,
				wedgeGateActive,
				enableSuggestionGate,
				showSessionEnergy,
				pendingKickoffSuggestionStatus: mapSuggestionGateStatus(
					pomodoro.pendingKickoffSuggestion.status,
				),
				focusedTaskId: pomodoro.focusedTaskId,
				continueTaskId: pomodoro.continueTaskId,
				hasPreFocusedKickoff: pomodoro.hasPreFocusedKickoff,
				workTypeDurationScopeAvailable: workTypeDurationScope != null,
				taskInventoryView: "list",
				recapAvailable: !recapLoading,
				showInFlowSummary,
				showBreakTransitionLine,
				recentlyClosedSession,
			}),
		[
			dataMode,
			pomodoro.cycleKind,
			pomodoro.state,
			wedgeGateActive,
			enableSuggestionGate,
			showSessionEnergy,
			pomodoro.pendingKickoffSuggestion.status,
			pomodoro.focusedTaskId,
			pomodoro.continueTaskId,
			pomodoro.hasPreFocusedKickoff,
			workTypeDurationScope,
			recapLoading,
			showInFlowSummary,
			showBreakTransitionLine,
			recentlyClosedSession,
		],
	);

	const recentlyClosedAtStateRef = useRef<HomeSessionState | null>(null);
	useEffect(() => {
		if (!recentlyClosedSession) {
			recentlyClosedAtStateRef.current = null;
			return;
		}
		if (recentlyClosedAtStateRef.current == null) {
			recentlyClosedAtStateRef.current = homeIa.state;
			return;
		}
		if (recentlyClosedAtStateRef.current !== homeIa.state) {
			recentlyClosedAtStateRef.current = null;
			setRecentlyClosedSession(false);
		}
	}, [recentlyClosedSession, homeIa.state]);

	// S-43: single illustration-variant derivation — same render pass as
	// deriveHomeSessionState(), downstream of committed cycle state (S-34).
	// Published once; consumed by the hero (via context in HomeShellContent)
	// and by the rail slot below.
	const homeIllustration = useMemo(() => {
		const input = {
			state: homeIa.state,
			narrativeLatestEnergy: pomodoro.narrativeLatestEnergy,
			recentlyClosedSession,
			wedgeGateActive,
		};
		return {
			variant: resolveIllustrationVariant(input),
			energyTint: resolveIllustrationEnergyTint(input),
		};
	}, [
		homeIa.state,
		pomodoro.narrativeLatestEnergy,
		recentlyClosedSession,
		wedgeGateActive,
	]);
	usePublishHomeIllustrationVariant(homeIllustration);

	const moduleInZone = (key: HomeModuleKey, zone: "primary" | "secondary") =>
		homeIa.modules[key] === zone;
	const moduleVisible = (key: HomeModuleKey) =>
		homeIa.modules[key] !== "hidden";

	// Mirrors DayMemoryLine's internal null-return (loading / no content) so
	// the primary region doesn't render around an empty component.
	const dayMemoryHasContent = useMemo(
		() =>
			formatDayMemory({
				recap,
				tasks,
				continueTaskId: pomodoro.continueTaskId,
				locale,
			}).hasContent,
		[recap, tasks, pomodoro.continueTaskId, locale],
	);
	const dayMemoryVisible =
		homeIa.state !== "active_work" && !recapLoading && dayMemoryHasContent;

	const showCalmLanding =
		homeIa.state === "idle" ||
		homeIa.state === "returning" ||
		homeIa.state === "active_work" ||
		homeIa.state === "steering";
	const hasFocusableTasks = tasks.some(
		(task) => task.status === "active" || task.status === "planned",
	);
	const hasActiveOrFocusedTask =
		pomodoro.focusedTaskId != null ||
		pomodoro.focusedTask != null ||
		hasFocusableTasks;
	const showFocusEmptyState =
		showCalmLanding && !hasActiveOrFocusedTask && !showSessionEnergy;
	const showFocusReadyState =
		showCalmLanding &&
		hasFocusableTasks &&
		pomodoro.state === "idle" &&
		!showSessionEnergy;

	const calmLandingSuggestionRequestedRef = useRef(false);

	useEffect(() => {
		if (!showFocusReadyState) {
			calmLandingSuggestionRequestedRef.current = false;
			return;
		}
		if (!enableSuggestionGate) {
			return;
		}
		if (pomodoro.focusedTaskId != null || pomodoro.focusedTask != null) {
			return;
		}
		if (pomodoro.pendingKickoffSuggestion.status !== "idle") {
			return;
		}
		if (calmLandingSuggestionRequestedRef.current) {
			return;
		}
		calmLandingSuggestionRequestedRef.current = true;
		pomodoro.ensureCalmLandingKickoffSuggestion();
	}, [
		enableSuggestionGate,
		showFocusReadyState,
		pomodoro.focusedTaskId,
		pomodoro.focusedTask,
		pomodoro.ensureCalmLandingKickoffSuggestion,
		pomodoro.pendingKickoffSuggestion.status,
	]);

	const dayMemoryOnCalmLanding = dayMemoryVisible && !showCalmLanding;

	const calmKickoffTask = useMemo(() => {
		if (pomodoro.focusedTask != null) {
			return pomodoro.focusedTask;
		}
		if (
			!showCalmLanding ||
			pomodoro.state !== "idle" ||
			showSessionEnergy ||
			pomodoro.pendingKickoffSuggestion.status !== "ready"
		) {
			return null;
		}
		const { taskId, title } = pomodoro.pendingKickoffSuggestion.data;
		return { id: taskId, title };
	}, [
		pomodoro.focusedTask,
		pomodoro.state,
		pomodoro.pendingKickoffSuggestion,
		showCalmLanding,
		showSessionEnergy,
	]);

	const showCalmKickoffTimer =
		showCalmLanding &&
		pomodoro.state === "idle" &&
		!showSessionEnergy &&
		calmKickoffTask != null;
	const embedKickoffInFocusReady = showFocusReadyState && showCalmKickoffTimer;

	const calmKickoffSuggestionCardData =
		useMemo((): TaskSuggestionData | null => {
			if (pomodoro.pendingKickoffSuggestion.status !== "ready") {
				return null;
			}
			const { data } = pomodoro.pendingKickoffSuggestion;
			return {
				taskId: Number(data.taskId),
				title: data.title,
				workType: data.workType,
				weight: data.weight,
				urgency: data.urgency,
				importance: data.importance,
				commitmentHorizon: data.commitmentHorizon,
				rationale: data.rationale,
				breakdown: data.breakdown,
				resumeNote: data.resumeNote,
			};
		}, [pomodoro.pendingKickoffSuggestion]);

	const calmKickoffSuggestedTaskId =
		pomodoro.pendingKickoffSuggestion.status === "ready"
			? pomodoro.pendingKickoffSuggestion.data.taskId
			: null;

	const todayPlanStats = useMemo(() => {
		const plan = recap?.todayPlan ?? [];
		const total = plan.length;
		const done = plan.filter((row) => row.doneForToday).length;
		return { total, done };
	}, [recap?.todayPlan]);

	const nextFocusUiActive = showKickoffDurationChips;

	const timerShown =
		!embedKickoffInFocusReady &&
		(showTimer || showCalmKickoffTimer) &&
		(moduleVisible("timer") ||
			pomodoro.state === "completed" ||
			showCalmKickoffTimer ||
			((pomodoro.focusedTaskId != null || pomodoro.focusedTask != null) &&
				!nextFocusUiActive));

	const timerZone: "primary" | "secondary" | null = !timerShown
		? null
		: moduleInZone("timer", "primary")
			? "primary"
			: moduleInZone("timer", "secondary")
				? "secondary"
				: "primary";

	const steeringCards =
		enableSuggestionGate && moduleVisible("steering") && showSessionEnergy ? (
			<SessionEnergyCard
				disabled={pomodoro.sessionSteeringSubmitting}
				onSelect={handleCompleteEnergy}
				onSkip={handleSkipEnergy}
			/>
		) : null;

	const statusLines =
		showInFlowSummary || showBreakTransitionLine ? (
			<>
				{showInFlowSummary && (
					<p
						aria-atomic="true"
						aria-live="polite"
						className="w-full rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-2 text-center text-sm text-text-secondary"
						data-testid="session-inflow-summary"
					>
						{pomodoro.inFlowSummaryLine}
					</p>
				)}
				{showBreakTransitionLine && (
					<button
						aria-atomic="true"
						aria-live="polite"
						className="w-full rounded-lg border border-energy-steady-border bg-energy-steady-bg px-4 py-3 text-center text-sm text-text-secondary"
						data-testid="break-transition-line"
						onClick={pomodoro.clearBreakTransitionLine}
						type="button"
					>
						{pomodoro.breakTransitionLine}
					</button>
				)}
			</>
		) : null;

	const kickoffDurationChips =
		moduleVisible("nextFocus") &&
		showKickoffDurationChips &&
		kickoffWorkType != null &&
		workTypeDurationScope != null ? (
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
		) : null;

	const handleCalmKickoffStart = useCallback(
		async (durationSec: number) => {
			if (
				pomodoroRef.current.focusedTaskId == null &&
				calmKickoffTask != null
			) {
				flushSync(() => {
					const cycle = pomodoroRef.current;
					if (
						cycle.pendingKickoffSuggestion.status === "ready" &&
						String(cycle.pendingKickoffSuggestion.data.taskId) ===
							String(calmKickoffTask.id)
					) {
						cycle.acceptKickoffSuggestion();
					} else {
						cycle.selectTask(calmKickoffTask.id, calmKickoffTask);
					}
				});
			}
			await handleStartWithPermission(durationSec);
		},
		[calmKickoffTask, handleStartWithPermission],
	);

	const timerPanel = timerShown ? (
		<TimerPanel
			configuredDurationSec={
				pomodoro.activeCycle?.configuredDurationSec ?? null
			}
			cycleKind={pomodoro.cycleKind}
			focusedTask={
				showCalmKickoffTimer ? calmKickoffTask : pomodoro.focusedTask
			}
			isStarting={false}
			onInterrupt={pomodoro.interrupt}
			onOutOfTabBreakAlertsChange={setOutOfTabBreakAlertsEnabled}
			onPause={pomodoro.pause}
			onResume={pomodoro.resume}
			onStart={
				showCalmKickoffTimer
					? handleCalmKickoffStart
					: handleStartWithPermission
			}
			onWorkDurationManualChange={pomodoro.clearStagedKickoffDuration}
			outOfTabBreakAlertsEnabled={outOfTabBreakAlertsEnabled}
			preferredWorkDurationSec={pomodoro.stagedKickoffDurationSec}
			remainingMs={pomodoro.remainingMs}
			state={pomodoro.state}
		/>
	) : null;

	const recapPanel =
		dataMode === "authenticated" && moduleVisible("recap") ? (
			<DailyRecapPanel
				isLoading={recapLoading}
				localDateKey={recapDateKey}
				recap={recap}
			/>
		) : null;

	const focusBudgetPrompt =
		dayPlan != null ? (
			<FocusBudgetPrompt
				hasBudget={dayPlan.hasBudget}
				isLoading={dayPlan.isLoading}
				isSettingBudget={dayPlan.isSettingBudget}
				localDateKey={dayPlan.localDateKey}
				onSetBudget={dayPlan.setBudget}
			/>
		) : null;

	const calmFocusSummary =
		dayPlan != null ? (
			<HomeFocusSummary
				budgetMinutes={dayPlan.budgetMinutes}
				forceShow={showCalmLanding}
				hasBudget={dayPlan.hasBudget}
				isLoading={dayPlan.isLoading}
				remainingMinutes={dayPlan.remainingMinutes}
				sessionsCompleted={pomodoro.completedWorkCycles}
				tasksDone={todayPlanStats.done}
				tasksTotal={todayPlanStats.total}
				usedMinutes={dayPlan.usedMinutes}
			/>
		) : showCalmLanding ? (
			<HomeFocusSummary
				budgetMinutes={null}
				forceShow
				hasBudget={false}
				isLoading={false}
				remainingMinutes={null}
				sessionsCompleted={pomodoro.completedWorkCycles}
				tasksDone={todayPlanStats.done}
				tasksTotal={todayPlanStats.total}
				usedMinutes={0}
			/>
		) : null;

	const calmWidgetsRail = showCalmLanding ? (
		<div className="flex w-full flex-col gap-4">
			{calmFocusSummary}
			<FocusTip />
			<QuickActions onAddTask={() => setShowAddModal(true)} />
		</div>
	) : null;

	const authenticatedContextRail = showCalmLanding ? (
		calmWidgetsRail
	) : (
		<>
			<div className="w-full" data-testid="home-rail-illustration">
				<HomeHeroSprig
					energyTint={homeIllustration.energyTint}
					variant={homeIllustration.variant}
				/>
			</div>
			{recapPanel}
			{dayPlan != null ? (
				<HomeFocusSummary
					budgetMinutes={dayPlan.budgetMinutes}
					hasBudget={dayPlan.hasBudget}
					isLoading={dayPlan.isLoading}
					remainingMinutes={dayPlan.remainingMinutes}
					sessionsCompleted={pomodoro.completedWorkCycles}
					tasksDone={todayPlanStats.done}
					tasksTotal={todayPlanStats.total}
					usedMinutes={dayPlan.usedMinutes}
				/>
			) : null}
		</>
	);

	const contextRailContent =
		dataMode === "authenticated" ? (
			authenticatedContextRail
		) : showCalmLanding ? (
			calmWidgetsRail
		) : (
			<GuestContextRail />
		);

	const focusEmptyStateElement = showFocusEmptyState ? (
		<FocusEmptyState onAddTask={() => setShowAddModal(true)} />
	) : null;

	const focusReadyStateElement = showFocusReadyState ? (
		<FocusReadyState
			autoSuggestedTaskId={calmKickoffSuggestedTaskId}
			isStartingKickoff={false}
			kickoffTask={embedKickoffInFocusReady ? calmKickoffTask : null}
			onAddTask={() => setShowAddModal(true)}
			onSelectTask={(task) => {
				pomodoro.selectTask(task.id, {
					id: task.id,
					title: task.title,
				});
			}}
			onStartKickoff={
				embedKickoffInFocusReady ? handleCalmKickoffStart : undefined
			}
			onWorkDurationManualChange={pomodoro.clearStagedKickoffDuration}
			preferredWorkDurationSec={pomodoro.stagedKickoffDurationSec}
			suggestionPopup={
				calmKickoffSuggestionCardData != null
					? {
							coachLine: effectiveSuggestionCoachLine,
							isAccepting: pomodoro.isAcceptingKickoffSuggestion,
							onAccept: () => {
								onSuggestionCoachSeen?.();
								const suggestedId = calmKickoffSuggestedTaskId;
								if (suggestedId == null) {
									return;
								}
								pomodoro.selectTask(suggestedId, {
									id: suggestedId,
									title: calmKickoffSuggestionCardData.title,
								});
							},
							suggestion: calmKickoffSuggestionCardData,
						}
					: null
			}
			tasks={tasks}
		/>
	) : null;

	const calmLandingHero =
		focusEmptyStateElement != null ? (
			<>
				{focusEmptyStateElement}
				<FocusInfoBanner variant="empty" />
				<FocusGettingStarted onAddTask={() => setShowAddModal(true)} />
			</>
		) : focusReadyStateElement != null ? (
			<>
				{focusReadyStateElement}
				<FocusInfoBanner variant="ready" />
			</>
		) : null;

	// Empty regions render nothing so they contribute no gap.
	// mirrors its region's child gates verbatim — keep them in sync when a
	// child is added or its condition changes.
	const primaryRegionHasContent =
		dayMemoryOnCalmLanding ||
		calmLandingHero != null ||
		(moduleInZone("steering", "primary") && steeringCards != null) ||
		(moduleInZone("nextFocus", "primary") && kickoffDurationChips != null) ||
		timerZone === "primary";

	const secondaryRegionHasContent =
		statusLines != null ||
		timerZone === "secondary" ||
		(moduleInZone("steering", "secondary") && steeringCards != null) ||
		pomodoro.overrideAcknowledgement != null ||
		(!showCalmLanding && dayPlan != null) ||
		(!showCalmLanding && recapPanel != null);

	return (
		<div className="flex w-full flex-col gap-6">
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
							{tDashboard("errorDismiss")}
						</button>
					</div>
				)
			)}

			<div
				className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-8"
				data-testid="home-workbench-grid"
			>
				<div className="order-1 flex flex-col gap-section">
					{primaryRegionHasContent && (
						<HomeLayoutRegion testId="home-primary-region">
							{dayMemoryOnCalmLanding && (
								<DayMemoryLine
									continueTaskId={pomodoro.continueTaskId}
									isLoading={recapLoading}
									recap={recap}
									tasks={tasks}
								/>
							)}
							{calmLandingHero}
							{moduleInZone("steering", "primary") && steeringCards}
							{moduleInZone("nextFocus", "primary") && kickoffDurationChips}
							{timerZone === "primary" && timerPanel}
						</HomeLayoutRegion>
					)}

					{secondaryRegionHasContent && (
						<HomeLayoutRegion testId="home-secondary-region">
							{statusLines}
							{timerZone === "secondary" && timerPanel}
							{moduleInZone("steering", "secondary") && steeringCards}
							{pomodoro.overrideAcknowledgement != null && (
								<p
									aria-atomic="true"
									aria-live="polite"
									className="w-full rounded-lg border border-energy-steady-border bg-energy-steady-bg px-4 py-3 text-center text-sm text-text-secondary"
									data-testid="suggestion-override-ack"
								>
									{pomodoro.overrideAcknowledgement}
								</p>
							)}
							{!showCalmLanding && dayPlan != null && (
								<div className="w-full lg:hidden">{focusBudgetPrompt}</div>
							)}
							{!showCalmLanding && recapPanel != null && (
								<div className="w-full lg:hidden">{recapPanel}</div>
							)}
						</HomeLayoutRegion>
					)}
				</div>

				{(showCalmLanding || contextRailContent != null) && (
					<HomeLayoutRegion
						className="order-2 max-lg:order-3 lg:max-w-none"
						testId="home-context-rail"
					>
						{contextRailContent}
					</HomeLayoutRegion>
				)}
			</div>

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
					onConfirm={async (markPrimary) => {
						pomodoro.dismissCatchUp();
						if (
							markPrimary &&
							focusedActiveTask?.isDailyStanding === true &&
							focusedActiveTask.doneForToday !== true
						) {
							await markDoneForToday({
								id: focusedActiveTask.id,
								localDateKey: recapDateKey,
							});
							await pomodoro.onCycleCompleteConfirm(false);
							return;
						}
						await pomodoro.onCycleCompleteConfirm(markPrimary);
					}}
					onDismissPreFocus={pomodoro.dismissPreFocus}
					preFocusedTask={pomodoro.preFocusedTask}
					primaryMarksDoneForToday={primaryMarksDoneForToday}
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
					cycleContext={pomodoro.cycleKind === "WORK" ? "work" : "break"}
					isSubmitting={isEndingSession}
					onCancel={handleEndSessionCancel}
					onConfirm={() => void handleEndSessionConfirm()}
					variant={endSessionConfirmVariant}
				/>
			)}

			{pomodoro.hasActiveSession && (
				<div className="flex flex-col items-center gap-2">
					{pomodoro.state === "running" && (
						<button
							className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition hover:border-energy-steady-border hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
							data-testid="pause-and-end-session-btn"
							disabled={pomodoro.isConfirming || isEndingSession}
							onClick={() => void handlePauseAndEndSessionClick()}
							type="button"
						>
							{tDashboard("pauseEndSession")}
						</button>
					)}
					<button
						className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary transition hover:border-red-400/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
						data-testid="end-session-btn"
						disabled={pomodoro.isConfirming || isEndingSession}
						onClick={handleEndSessionClick}
						type="button"
					>
						{tDashboard("endSession")}
					</button>
				</div>
			)}

			{showAddModal && (
				<AddTaskModal
					isCreating={isCreating}
					onClose={() => setShowAddModal(false)}
					onCreate={async (input) => {
						await createTask(input);
					}}
				/>
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

	return (
		<PomodoroDashboardBody
			dayPlan={dayPlan}
			enableCheckInGate
			enableSuggestionGate
			enableWindDownGate
			onboardingScope={onboardingScope}
			onboardingState={onboardingState}
			onCheckInCoachSeen={markCheckInCoachSeen}
			onSuggestionCoachSeen={markSuggestionCoachSeen}
			refreshTasks={refreshTasks}
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

	return (
		<PomodoroDashboardBody
			onboardingScope={guestScope}
			refreshTasks={refresh}
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
