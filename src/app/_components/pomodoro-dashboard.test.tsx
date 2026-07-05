import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTask } from "~/lib/data-mode/types";
import { defaultEisenhowerFields } from "~/lib/data-mode/types";
import type { OnboardingScope } from "~/lib/onboarding/types";
import { BREAK_START_SHORT } from "~/lib/session/transition-copy";

import { PomodoroDashboardBody } from "./pomodoro-dashboard";

const authenticatedOnboardingScope: OnboardingScope = {
	mode: "authenticated",
	userId: "test-user",
};

const usePomodoroCycleMock = vi.fn();

vi.mock("~/hooks/use-pomodoro-cycle", () => ({
	usePomodoroCycle: (...args: unknown[]) => usePomodoroCycleMock(...args),
}));

vi.mock("~/hooks/use-e2e-expose-cycle-recovery", () => ({
	useE2eExposeCycleRecovery: () => {},
}));

const useDailyRecapMock = vi.fn();

vi.mock("~/hooks/use-daily-recap", () => ({
	useDailyRecap: (...args: unknown[]) => useDailyRecapMock(...args),
}));

const defaultDailyRecap = {
	recap: { last24Hours: [], todayPlan: [], footprints: {} },
	isLoading: false,
	localDateKey: "2026-06-20",
};

beforeEach(() => {
	useDailyRecapMock.mockReturnValue(defaultDailyRecap);
});

vi.mock("~/hooks/use-task-mutations", () => ({
	useTaskMutations: () => ({
		markDoneForToday: vi.fn().mockResolvedValue(undefined),
	}),
}));

vi.mock("./task-list", () => ({
	TaskList: ({ onOpenArchive }: { onOpenArchive?: () => void }) => (
		<div data-testid="task-list-stub">
			{onOpenArchive != null ? (
				<button
					data-testid="task-archive-entry"
					onClick={onOpenArchive}
					type="button"
				>
					Archived tasks
				</button>
			) : null}
		</div>
	),
}));

vi.mock("./task-archive-view", () => ({
	TaskArchiveView: ({ onBack }: { onBack: () => void }) => (
		<div data-testid="task-archive-view">
			<button data-testid="task-archive-back" onClick={onBack} type="button">
				Back
			</button>
		</div>
	),
}));

const mockGetNotificationPermission = vi.fn(
	(): NotificationPermission => "default",
);
const mockShouldDeferFirstRun = vi.fn(() => false);
const mockReadNotificationPromptDismissed = vi.fn(
	(_scope: OnboardingScope) => false,
);
const mockWriteNotificationPromptDismissed = vi.fn(
	(_scope: OnboardingScope, _dismissed: boolean) => undefined,
);

vi.mock("~/lib/break-out-of-tab-alert/notify-break-start", () => ({
	getNotificationPermission: () => mockGetNotificationPermission(),
	requestNotificationPermission: vi.fn().mockResolvedValue("granted"),
}));

vi.mock("~/lib/onboarding/defer", () => ({
	shouldDeferFirstRun: () => mockShouldDeferFirstRun(),
}));

vi.mock("~/lib/break-out-of-tab-alert/storage", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("~/lib/break-out-of-tab-alert/storage")
		>();
	return {
		...actual,
		readNotificationPromptDismissed: (
			...args: Parameters<typeof actual.readNotificationPromptDismissed>
		) => mockReadNotificationPromptDismissed(...args),
		writeNotificationPromptDismissed: (
			...args: Parameters<typeof actual.writeNotificationPromptDismissed>
		) => mockWriteNotificationPromptDismissed(...args),
	};
});

const tasks: DomainTask[] = [
	{
		id: "task-1",
		title: "Focus task",
		status: "active",
		userId: "user-1",
		createdAt: new Date(),
		updatedAt: null,
		workType: "OPERATIONAL",
		weight: 2,
		...defaultEisenhowerFields(2),
		sortOrder: 0,
		resumeNote: null,
		project: null,
		archivedAt: null,
	},
];

function makePomodoroMock(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		state: "idle",
		remainingMs: 1_500_000,
		focusedTask: null,
		focusedTaskId: null,
		activeCycle: null,
		cycleKind: "WORK",
		hasActiveSession: false,
		error: null,
		pendingWedgeRecovery: null,
		midCyclePendingTask: null,
		isMidCycleSubmitting: false,
		awaitingCheckIn: false,
		isPostCheckInTransitioning: false,
		awaitingWindDown: false,
		windDownRationale: null,
		isConfirming: false,
		isWedgeSyncRetrying: false,
		pendingSuggestion: { status: "idle" },
		pendingKickoffSuggestion: { status: "idle" },
		kickoffSuggestedTaskId: null,
		hasPreFocusedKickoff: false,
		hasPreFocusedSuggestion: false,
		stagedKickoffDurationSec: null,
		isAcceptingKickoffSuggestion: false,
		overrideAcknowledgement: null,
		breakTransitionLine: null,
		clearBreakTransitionLine: vi.fn(),
		narrativeLatestEnergy: null,
		inFlowSummaryLine: null,
		pendingClosureLine: null,
		continueTaskId: null,
		dismissSessionClosure: vi.fn(),
		showSessionEnergy: false,
		showSessionFocus: false,
		sessionEnergyPending: false,
		sessionFocusPending: false,
		sessionSteeringSubmitting: false,
		completeSessionEnergy: vi.fn(),
		skipSessionEnergy: vi.fn(),
		completeSessionFocus: vi.fn(),
		skipSessionFocus: vi.fn(),
		kickoffEligible: false,
		preFocusedTask: null,
		catchUp: null,
		suggestionCycleId: null,
		suggestedTaskId: null,
		clearError: vi.fn(),
		dismissCatchUp: vi.fn(),
		selectTask: vi.fn(),
		clearTask: vi.fn(),
		acceptSuggestion: vi.fn(),
		acceptKickoffSuggestion: vi.fn(),
		selectKickoffDuration: vi.fn(),
		clearStagedKickoffDuration: vi.fn(),
		clearSuggestion: vi.fn(),
		clearKickoffSuggestion: vi.fn(),
		dismissPreFocus: vi.fn(),
		retryKickoffSuggestion: vi.fn(),
		retrySuggestion: vi.fn(),
		retryWedgeSync: vi.fn(),
		dismissPendingWedgeRecovery: vi.fn(),
		start: vi.fn(),
		interrupt: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		confirmComplete: vi.fn(),
		onCycleCompleteConfirm: vi.fn(),
		submitCheckIn: vi.fn(),
		onWindDownKeepGoing: vi.fn(),
		onWindDownEndSession: vi.fn(),
		onMidCycleMarkComplete: vi.fn(),
		onMidCycleContinueWithTask: vi.fn(),
		onMidCycleEndCycleAndBreak: vi.fn(),
		endSession: vi.fn(),
		...overrides,
	};
}

function renderBody(overrides: Record<string, unknown> = {}) {
	usePomodoroCycleMock.mockReturnValue(makePomodoroMock(overrides));

	return render(
		<PomodoroDashboardBody
			cycleEndAudioMode="muted"
			refreshTasks={async () => {}}
			setCycleEndAudioMode={vi.fn()}
			tasks={tasks}
			{...{
				enableCheckInGate: false,
				enableWindDownGate: false,
				enableSuggestionGate: false,
			}}
		/>,
	);
}

describe("PomodoroDashboardBody overlay visibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows idle timer panel when a task is focused", () => {
		renderBody({
			focusedTask: { id: 1, title: "Focus task" },
			state: "idle",
		});

		expect(screen.getByTestId("timer-panel-idle")).toBeTruthy();
	});

	it("shows check-in overlay when awaiting check-in gate is open", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				awaitingCheckIn: true,
				activeCycle: { id: 42 },
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableCheckInGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("check-in-overlay")).toBeTruthy();
	});

	it("hides check-in overlay when cycle is paused (pol-12)", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "paused",
				awaitingCheckIn: true,
				activeCycle: { id: 42 },
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableCheckInGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("check-in-overlay")).toBeNull();
	});

	it("hides break suggestion card when paused and shows after resume", () => {
		const suggestionReady = {
			status: "ready" as const,
			data: {
				taskId: "task-1",
				title: "Suggested task",
				workType: "OPERATIONAL" as const,
				weight: 2 as const,
				rationale: "Best next task",
				breakdown: null,
			},
		};

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "paused",
				cycleKind: "SHORT_BREAK",
				pendingSuggestion: suggestionReady,
			}),
		);

		const { rerender } = render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("task-suggestion-card")).toBeNull();

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "running",
				cycleKind: "SHORT_BREAK",
				pendingSuggestion: suggestionReady,
			}),
		);

		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
	});

	it("shows mid-cycle prompt when a task completion is pending", () => {
		renderBody({
			midCyclePendingTask: { id: 1, title: "Completed task" },
		});

		expect(screen.getByTestId("mid-cycle-prompt-overlay")).toBeTruthy();
	});

	it("shows wind-down overlay when wind-down gate is enabled", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				awaitingWindDown: true,
				windDownRationale: "You've been at it for a while.",
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableWindDownGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("wind-down-overlay")).toBeTruthy();
	});

	it("shows kickoff suggestion card when suggestion gate is enabled", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				pendingKickoffSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
	});

	it("shows in-flow summary on idle break when narrative line is present", () => {
		renderBody({
			hasActiveSession: true,
			state: "idle",
			cycleKind: "SHORT_BREAK",
			inFlowSummaryLine: "2 cycles · 1 task done · feeling steady",
		});

		expect(screen.getByTestId("session-inflow-summary").textContent).toBe(
			"2 cycles · 1 task done · feeling steady",
		);
	});

	it("hides in-flow summary while check-in gate is open", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "idle",
				cycleKind: "SHORT_BREAK",
				inFlowSummaryLine: "2 cycles · feeling steady",
				awaitingCheckIn: true,
				activeCycle: { id: 42 },
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableCheckInGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("session-inflow-summary")).toBeNull();
	});

	it("hides in-flow summary when post-check-in suggestion card is visible", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "running",
				cycleKind: "SHORT_BREAK",
				inFlowSummaryLine: "2 cycles · feeling steady",
				pendingSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
		expect(screen.queryByTestId("session-inflow-summary")).toBeNull();
	});

	it("shows in-flow summary alongside kickoff suggestion card", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "idle",
				focusedTaskId: null,
				inFlowSummaryLine: "2 cycles · feeling steady",
				pendingKickoffSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
		expect(screen.getByTestId("session-inflow-summary").textContent).toBe(
			"2 cycles · feeling steady",
		);
	});

	it("shows inline session energy card when showSessionEnergy is true", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				showSessionEnergy: true,
				sessionEnergyPending: true,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-energy-card")).toBeTruthy();
		expect(screen.queryByTestId("kickoff-readiness-overlay")).toBeNull();
		expect(screen.queryByTestId("cycle-intention-prompt")).toBeNull();
	});

	it("shows inline session focus card when showSessionFocus is true", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				showSessionFocus: true,
				sessionFocusPending: true,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-focus-card")).toBeTruthy();
	});

	it("dismisses cycle complete overlay after Continue later confirm", async () => {
		const onCycleCompleteConfirm = vi.fn().mockResolvedValue(undefined);

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "completed",
				cycleKind: "WORK",
				focusedTask: { id: 1, title: "Focus task" },
				onCycleCompleteConfirm,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableCheckInGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("cycle-complete-overlay")).toBeTruthy();

		await fireEvent.click(
			screen.getByRole("button", { name: /Continue later/i }),
		);

		expect(onCycleCompleteConfirm).toHaveBeenCalledWith(false);
	});

	it("shows session closure overlay when pending closure line is set", () => {
		renderBody({
			pendingClosureLine: "Session complete — 1 cycle. Take a breath.",
		});

		expect(screen.getByTestId("session-closure-overlay")).toBeTruthy();
		expect(screen.getByTestId("session-closure-line").textContent).toBe(
			"Session complete — 1 cycle. Take a breath.",
		);
	});

	it("does not show kickoff suggestion while session energy card is visible", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				showSessionEnergy: true,
				sessionEnergyPending: true,
				pendingKickoffSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-energy-card")).toBeTruthy();
		expect(screen.queryByTestId("task-suggestion-card")).toBeNull();
	});

	it("does not show kickoff suggestion while session focus card is visible", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				showSessionFocus: true,
				sessionFocusPending: true,
				pendingKickoffSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-focus-card")).toBeTruthy();
		expect(screen.queryByTestId("task-suggestion-card")).toBeNull();
	});

	it("does not show check-in overlay while session closure is pending on idle entry", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				pendingClosureLine: "Session complete — 1 cycle. Take a breath.",
				awaitingCheckIn: true,
				activeCycle: { id: 42 },
				state: "completed",
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableCheckInGate
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("session-closure-overlay")).toBeNull();
		expect(screen.getByTestId("check-in-overlay")).toBeTruthy();
	});

	it("shows break transition line during running short break", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			breakTransitionLine: BREAK_START_SHORT,
		});

		expect(screen.getByTestId("break-transition-line").textContent).toBe(
			BREAK_START_SHORT,
		);
	});

	it("hides break transition line when post-check-in suggestion card is visible", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "running",
				cycleKind: "SHORT_BREAK",
				breakTransitionLine: BREAK_START_SHORT,
				pendingSuggestion: {
					status: "ready",
					data: {
						taskId: "task-1",
						title: "Suggested task",
						workType: "OPERATIONAL",
						weight: 2,
						rationale: "Best next task",
						breakdown: null,
					},
				},
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("task-suggestion-card")).toBeTruthy();
		expect(screen.queryByTestId("break-transition-line")).toBeNull();
	});

	it("hides break transition line when in-flow summary is visible", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			breakTransitionLine: BREAK_START_SHORT,
			inFlowSummaryLine: "2 cycles · feeling steady",
		});

		expect(screen.queryByTestId("break-transition-line")).toBeNull();
		expect(screen.getByTestId("session-inflow-summary")).toBeTruthy();
	});

	it("skip click clears break transition line", () => {
		const clearBreakTransitionLine = vi.fn();
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			breakTransitionLine: BREAK_START_SHORT,
			clearBreakTransitionLine,
		});

		fireEvent.click(screen.getByTestId("break-transition-line"));
		expect(clearBreakTransitionLine).toHaveBeenCalled();
	});

	it("announces in-flow summary through a polite live region", () => {
		renderBody({
			hasActiveSession: true,
			state: "idle",
			cycleKind: "SHORT_BREAK",
			inFlowSummaryLine: "2 cycles · 1 task done · feeling steady",
		});

		const summary = screen.getByTestId("session-inflow-summary");
		expect(summary.getAttribute("aria-live")).toBe("polite");
	});

	it("announces break transition through a polite live region", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			breakTransitionLine: BREAK_START_SHORT,
		});

		const line = screen.getByTestId("break-transition-line");
		expect(line.getAttribute("aria-live")).toBe("polite");
	});

	it("announces suggestion override acknowledgement politely", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			overrideAcknowledgement: "Got it — focusing on your pick.",
		});

		const ack = screen.getByTestId("suggestion-override-ack");
		expect(ack.getAttribute("aria-live")).toBe("polite");
		expect(ack.textContent).toBe("Got it — focusing on your pick.");
	});
});

describe("PomodoroDashboardBody end session while running", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("keeps end session enabled during a running cycle", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
		});

		expect(screen.getByTestId("end-session-btn")).toHaveProperty(
			"disabled",
			false,
		);
	});

	it("opens confirm overlay on end session click when running", () => {
		const endSession = vi.fn();
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
			endSession,
		});

		fireEvent.click(screen.getByTestId("end-session-btn"));

		expect(screen.getByTestId("end-session-confirm-overlay")).toBeTruthy();
		expect(endSession).not.toHaveBeenCalled();
	});

	it("dismisses confirm overlay on cancel without ending session", () => {
		const endSession = vi.fn();
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
			endSession,
		});

		fireEvent.click(screen.getByTestId("end-session-btn"));
		fireEvent.click(screen.getByTestId("end-session-confirm-cancel-btn"));

		expect(screen.queryByTestId("end-session-confirm-overlay")).toBeNull();
		expect(endSession).not.toHaveBeenCalled();
	});

	it("calls endSession once when confirm is accepted", async () => {
		const endSession = vi.fn().mockResolvedValue(undefined);
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
			endSession,
		});

		fireEvent.click(screen.getByTestId("end-session-btn"));
		fireEvent.click(screen.getByTestId("end-session-confirm-btn"));

		await vi.waitFor(() => {
			expect(endSession).toHaveBeenCalledTimes(1);
		});
	});

	it("shows pause and end session when running", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
		});

		expect(screen.getByTestId("pause-and-end-session-btn")).toBeTruthy();
	});

	it("pauses then opens after-pause confirm on pause and end click", async () => {
		const pause = vi.fn().mockResolvedValue(undefined);
		const endSession = vi.fn();
		renderBody({
			hasActiveSession: true,
			state: "running",
			activeCycle: { id: 42 },
			pause,
			endSession,
		});

		fireEvent.click(screen.getByTestId("pause-and-end-session-btn"));

		await waitFor(() => {
			expect(pause).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(screen.getByTestId("end-session-confirm-overlay")).toBeTruthy();
		});
		expect(screen.getByText("Stay paused")).toBeTruthy();
		expect(endSession).not.toHaveBeenCalled();
	});

	it("shows break-neutral confirm copy when ending during SHORT_BREAK", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			activeCycle: { id: 42 },
		});

		fireEvent.click(screen.getByTestId("end-session-btn"));

		expect(screen.getByTestId("end-session-confirm-overlay")).toBeTruthy();
		expect(screen.queryByText(/focus block/i)).toBeNull();
	});
});

describe("PomodoroDashboardBody break-alerts permission deferral", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		mockGetNotificationPermission.mockReturnValue("default");
		mockShouldDeferFirstRun.mockReturnValue(false);
		mockReadNotificationPromptDismissed.mockReturnValue(false);
	});

	function renderReadyToStartWithDeferredPermission() {
		const start = vi.fn().mockResolvedValue(undefined);
		const skipSessionEnergy = vi.fn();

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTask: { id: 1, title: "Focus task" },
				showSessionEnergy: true,
				sessionEnergyPending: true,
				start,
				skipSessionEnergy,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		fireEvent.click(screen.getByTestId("session-energy-skip-btn"));

		return { start, skipSessionEnergy };
	}

	function clickStartCycle() {
		fireEvent.click(
			screen.getByRole("button", { name: "Start cycle for Focus task" }),
		);
	}

	it("defers pomodoro.start behind the permission prompt after steering completes", () => {
		const { start } = renderReadyToStartWithDeferredPermission();

		clickStartCycle();

		expect(screen.getByTestId("break-alerts-permission-prompt")).toBeTruthy();
		expect(start).not.toHaveBeenCalled();
	});

	it("replays deferred pomodoro.start once after permission prompt dismiss", async () => {
		const { start } = renderReadyToStartWithDeferredPermission();

		clickStartCycle();
		fireEvent.click(screen.getByTestId("break-alerts-permission-not-now-btn"));

		await waitFor(() => {
			expect(start).toHaveBeenCalledTimes(1);
		});
		expect(start).toHaveBeenCalledWith(25 * 60);
		expect(screen.queryByTestId("break-alerts-permission-prompt")).toBeNull();
		expect(mockWriteNotificationPromptDismissed).toHaveBeenCalledWith(
			authenticatedOnboardingScope,
			true,
		);
	});

	it("replays deferred pomodoro.start once after permission prompt enable", async () => {
		const { start } = renderReadyToStartWithDeferredPermission();

		clickStartCycle();
		fireEvent.click(screen.getByTestId("break-alerts-permission-enable-btn"));

		await waitFor(() => {
			expect(start).toHaveBeenCalledTimes(1);
		});
		expect(start).toHaveBeenCalledWith(25 * 60);
		expect(screen.queryByTestId("break-alerts-permission-prompt")).toBeNull();
	});
});

describe("PomodoroDashboardBody wedge sync recovery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows wedge-sync-recovery with retry instead of generic pomodoro-error", () => {
		const retryWedgeSync = vi.fn();
		const dismissPendingWedgeRecovery = vi.fn();

		renderBody({
			error: "Could not save check-in. Try again.",
			pendingWedgeRecovery: {
				message: "Could not save check-in. Try again.",
				phase: "check_in",
				energy: "FOCUSED",
			},
			retryWedgeSync,
			dismissPendingWedgeRecovery,
		});

		expect(screen.getByTestId("wedge-sync-recovery")).toBeTruthy();
		expect(screen.queryByTestId("pomodoro-error")).toBeNull();
		expect(screen.getByText(/Energy: Focused/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retryWedgeSync).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(dismissPendingWedgeRecovery).toHaveBeenCalledTimes(1);
	});
});

const FILLED_PRIMARY_CTA_IDS = [
	"suggestion-accept-btn",
	"timer-start-cycle",
	"timer-pause",
	"timer-resume",
] as const;

function countEnabledPrimaryCtas(): number {
	// Empty regions no longer render (D-01 composition contract).
	const primary = screen.queryByTestId("home-primary-region");
	if (primary == null) {
		return 0;
	}
	return FILLED_PRIMARY_CTA_IDS.filter((id) => {
		const element = within(primary).queryByTestId(id);
		return element != null && !(element as HTMLButtonElement).disabled;
	}).length;
}

function expectOutsidePrimaryRegion(testId: string): void {
	const primary = screen.queryByTestId("home-primary-region");
	if (primary == null) {
		return;
	}
	expect(within(primary).queryByTestId(testId)).toBeNull();
}

function expectInsideRegion(
	regionId: "home-primary-region" | "home-secondary-region",
	testId: string,
): void {
	expect(within(screen.getByTestId(regionId)).getByTestId(testId)).toBeTruthy();
}

const kickoffSuggestionReady = {
	status: "ready" as const,
	data: {
		taskId: "task-1",
		title: "Suggested task",
		workType: "OPERATIONAL" as const,
		weight: 2 as const,
		rationale: "Best next task",
		breakdown: null,
	},
};

const breakSuggestionReady = {
	status: "ready" as const,
	data: {
		taskId: "task-1",
		title: "Suggested task",
		workType: "OPERATIONAL" as const,
		weight: 2 as const,
		rationale: "Best next task",
		breakdown: null,
	},
};

describe("PomodoroDashboardBody home IA layout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("idle kickoff shows exactly one filled primary CTA and demotes inventory controls", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				pendingKickoffSuggestion: kickoffSuggestionReady,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "suggestion-accept-btn");
		expectOutsidePrimaryRegion("task-archive-entry");
		expectInsideRegion("home-secondary-region", "task-list-stub");
	});

	it("returning state shows one filled primary CTA with inventory outside primary", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				cycleKind: null,
				focusedTaskId: null,
				continueTaskId: "task-1",
				pendingKickoffSuggestion: kickoffSuggestionReady,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "suggestion-accept-btn");
		expectOutsidePrimaryRegion("task-archive-entry");
	});

	it("idle focused task shows timer start as the sole primary CTA", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "timer-start-cycle");
		expectOutsidePrimaryRegion("task-archive-entry");
	});

	it("active work keeps timer primary, hides recap, and demotes inventory", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "WORK",
			activeCycle: { id: 42 },
			focusedTask: { id: 1, title: "Focus task" },
		});

		expectInsideRegion("home-primary-region", "timer-pause");
		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
		expectInsideRegion("home-secondary-region", "task-list-stub");
		expectOutsidePrimaryRegion("task-list-stub");
	});

	it("break with suggestion keeps next-focus primary and timer secondary", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "running",
				cycleKind: "SHORT_BREAK",
				activeCycle: { id: 42 },
				focusedTask: { id: 1, title: "Focus task" },
				pendingSuggestion: breakSuggestionReady,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "suggestion-accept-btn");
		expectInsideRegion("home-secondary-region", "timer-pause");
		expectInsideRegion("home-secondary-region", "task-list-stub");
	});

	it("break without suggestion keeps timer primary with secondary inventory", () => {
		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			activeCycle: { id: 42 },
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "timer-pause");
		expectInsideRegion("home-secondary-region", "task-list-stub");
	});

	it("steering keeps inline session energy primary without overlay gates", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				showSessionEnergy: true,
				sessionEnergyPending: true,
				pendingKickoffSuggestion: kickoffSuggestionReady,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expectInsideRegion("home-primary-region", "session-energy-card");
		expect(screen.queryByTestId("kickoff-readiness-overlay")).toBeNull();
		expect(screen.queryByTestId("cycle-intention-prompt")).toBeNull();
		expect(screen.queryByTestId("task-suggestion-card")).toBeNull();
	});

	it("archive view keeps archive in secondary zone and back navigation reachable", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		fireEvent.click(screen.getByTestId("task-archive-entry"));

		expectInsideRegion("home-secondary-region", "task-archive-view");
		expectInsideRegion("home-secondary-region", "task-archive-back");
		expect(screen.queryByTestId("task-list-stub")).toBeNull();
	});
});

const nonEmptyDailyRecap = {
	recap: {
		last24Hours: [
			{
				taskId: "task-1",
				title: "Focus task",
				firstStartedAt: new Date("2026-06-20T09:00:00Z"),
				lastEndedAt: new Date("2026-06-20T09:45:00Z"),
				focusedMinutes: 45,
			},
		],
		todayPlan: [
			{
				taskId: "task-2",
				title: "Remaining task",
				isDailyStanding: false,
				doneForToday: false,
				effortMinutes: null,
			},
		],
		footprints: {},
	},
	isLoading: false,
	localDateKey: "2026-06-20",
};

describe("PomodoroDashboardBody day-memory line", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows day-memory line inside home-primary-region when recap has content", () => {
		useDailyRecapMock.mockReturnValue(nonEmptyDailyRecap);

		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		expectInsideRegion("home-primary-region", "day-memory-line");
	});

	it("hides day-memory line during active work even when recap has content", () => {
		useDailyRecapMock.mockReturnValue(nonEmptyDailyRecap);

		renderBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "WORK",
			activeCycle: { id: 42 },
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(screen.queryByTestId("day-memory-line")).toBeNull();
	});

	it("omits day-memory line when recap has no content", () => {
		useDailyRecapMock.mockReturnValue(defaultDailyRecap);

		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(screen.queryByTestId("day-memory-line")).toBeNull();
	});

	it("shows day-memory line again once active work ends and idle state returns", () => {
		useDailyRecapMock.mockReturnValue(nonEmptyDailyRecap);

		const { rerender } = render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "running",
				cycleKind: "WORK",
				activeCycle: { id: 42 },
				focusedTask: { id: 1, title: "Focus task" },
			}),
		);
		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("day-memory-line")).toBeNull();

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTask: { id: 1, title: "Focus task" },
			}),
		);
		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expectInsideRegion("home-primary-region", "day-memory-line");
	});
});

describe("PomodoroDashboardBody desktop workbench frame", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("widens dashboard root at lg breakpoint", () => {
		const { container } = renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		const root = container.firstElementChild;
		expect(root?.className).toContain("max-w-lg");
		expect(root?.className).toContain("lg:max-w-7xl");
	});

	it("applies desktop workbench grid with 62/38 decision-rail split", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		const grid = screen.getByTestId("home-workbench-grid");
		expect(grid.className).toContain("lg:grid");
		expect(grid.className).toContain(
			"lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]",
		);
	});

	it("renders structural context rail zone for desktop layout", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		const rail = screen.getByTestId("home-context-rail");
		expect(rail.className).toContain("hidden");
		expect(rail.className).toContain("lg:flex");
	});

	it("does not render the retired inventory zone placeholder", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(screen.queryByTestId("home-inventory-zone")).toBeNull();
	});

	it("regions own the width contract and section gap", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		for (const testId of [
			"home-primary-region",
			"home-secondary-region",
			"home-context-rail",
		]) {
			const region = screen.getByTestId(testId);
			expect(region.className).toContain("max-w-lg");
			expect(region.className).toContain("lg:max-w-none");
			expect(region.className).toContain("gap-section");
		}
	});

	it("never renders an empty layout region", () => {
		for (const overrides of [
			{ state: "idle" as const },
			{ state: "idle" as const, focusedTask: { id: 1, title: "Focus task" } },
			{ state: "running" as const, focusedTask: { id: 1, title: "Focus" } },
			{ state: "break" as const },
		]) {
			const { unmount } = renderBody(overrides);
			for (const testId of [
				"home-primary-region",
				"home-secondary-region",
				"home-context-rail",
			]) {
				const region = screen.queryByTestId(testId);
				if (region != null) {
					expect(region.childElementCount).toBeGreaterThan(0);
				}
			}
			unmount();
		}
	});
});

const AUTH_RAIL_BLOCK_IDS = [
	"home-rail-illustration",
	"daily-recap-panel",
	"home-focus-summary",
] as const;

const GUEST_RAIL_BLOCK_IDS = [
	"guest-rail-value-prop",
	"guest-rail-activation-hint",
	"guest-rail-guidance",
] as const;

function getAcceptedRailBlocks(ids: readonly string[]): string[] {
	const rail = screen.getByTestId("home-context-rail");
	return ids.filter((id) => within(rail).queryByTestId(id) != null);
}

const mockDayPlanWithBudget = {
	localDateKey: "2026-06-20",
	hasBudget: true,
	isLoading: false,
	budgetMinutes: 240,
	remainingMinutes: 120,
	usedMinutes: 120,
	isSettingBudget: false,
	setBudget: vi.fn(),
};

describe("PomodoroDashboardBody rail illustration variant", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function renderAuthenticatedBody(overrides: Record<string, unknown> = {}) {
		usePomodoroCycleMock.mockReturnValue(makePomodoroMock(overrides));

		return render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);
	}

	function railVariantElement(): Element | null {
		return screen
			.getByTestId("home-rail-illustration")
			.querySelector("[data-illustration-variant]");
	}

	it("renders the idle variant in the rail slot at rest", () => {
		renderAuthenticatedBody({ state: "idle" });

		expect(
			railVariantElement()?.getAttribute("data-illustration-variant"),
		).toBe("idle");
	});

	it("renders the work variant with energy tint during a running work cycle", () => {
		renderAuthenticatedBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "WORK",
			activeCycle: { id: 42 },
			focusedTask: { id: 1, title: "Focus task" },
			narrativeLatestEnergy: "FOCUSED",
		});

		const element = railVariantElement();
		expect(element?.getAttribute("data-illustration-variant")).toBe("work");
		expect(element?.getAttribute("data-illustration-energy")).toBe("FOCUSED");
	});

	it("renders the break variant without energy tint during a running break", () => {
		renderAuthenticatedBody({
			hasActiveSession: true,
			state: "running",
			cycleKind: "SHORT_BREAK",
			activeCycle: { id: 42 },
			narrativeLatestEnergy: "FOCUSED",
		});

		const element = railVariantElement();
		expect(element?.getAttribute("data-illustration-variant")).toBe("break");
		expect(element?.getAttribute("data-illustration-energy")).toBeNull();
	});

	it("renders the energy_choice variant while inline session steering is open", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				showSessionEnergy: true,
				sessionEnergyPending: true,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(
			railVariantElement()?.getAttribute("data-illustration-variant"),
		).toBe("energy_choice");
	});

	it("shows the closure variant after the session closure gate dismisses, then clears on the next state change", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				pendingClosureLine: "Session complete — 1 cycle. Take a breath.",
			}),
		);

		const { rerender } = render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-closure-overlay")).toBeTruthy();

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({ pendingClosureLine: null }),
		);
		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("session-closure-overlay")).toBeNull();
		expect(
			railVariantElement()?.getAttribute("data-illustration-variant"),
		).toBe("closure");

		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				hasActiveSession: true,
				state: "running",
				cycleKind: "WORK",
				activeCycle: { id: 42 },
				focusedTask: { id: 1, title: "Focus task" },
			}),
		);
		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(
			railVariantElement()?.getAttribute("data-illustration-variant"),
		).toBe("work");
	});

	it("does not show the closure variant when the gate is suppressed without dismissal", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				pendingClosureLine: "Session complete — 1 cycle. Take a breath.",
			}),
		);

		const { rerender } = render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.getByTestId("session-closure-overlay")).toBeTruthy();

		// Gate hidden by cycle recovery (running work cycle) while the closure
		// line is still pending — a suppression, not a dismissal.
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				pendingClosureLine: "Session complete — 1 cycle. Take a breath.",
				hasActiveSession: true,
				state: "running",
				cycleKind: "WORK",
				activeCycle: { id: 42 },
				focusedTask: { id: 1, title: "Focus task" },
			}),
		);
		rerender(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(screen.queryByTestId("session-closure-overlay")).toBeNull();
		expect(
			railVariantElement()?.getAttribute("data-illustration-variant"),
		).toBe("work");
	});
});

describe("PomodoroDashboardBody context rail content", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("authenticated rail has at most three accepted blocks with illustration, recap, and focus summary when budget is set", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				dayPlan={mockDayPlanWithBudget}
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		const blocks = getAcceptedRailBlocks(AUTH_RAIL_BLOCK_IDS);
		expect(blocks.length).toBeLessThanOrEqual(3);
		expect(blocks).toContain("home-rail-illustration");
		expect(blocks).toContain("daily-recap-panel");
		expect(blocks).toContain("home-focus-summary");
		expect(screen.queryByTestId("focus-budget-prompt")).toBeNull();
		expect(countEnabledPrimaryCtas()).toBeLessThanOrEqual(1);
	});

	it("guest rail has at most three accepted blocks with sign-in value, activation hint, and calm guidance", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		const rail = screen.getByTestId("home-context-rail");
		const blocks = getAcceptedRailBlocks(GUEST_RAIL_BLOCK_IDS);
		expect(blocks.length).toBeLessThanOrEqual(3);
		expect(blocks).toContain("guest-rail-value-prop");
		expect(blocks).toContain("guest-rail-activation-hint");
		expect(blocks).toContain("guest-rail-guidance");
		expect(within(rail).queryByTestId("daily-recap-panel")).toBeNull();
		expect(within(rail).queryByTestId("focus-budget-prompt")).toBeNull();
		expect(within(rail).queryByTestId("home-focus-summary")).toBeNull();
	});

	it("guest rail excludes persisted-data panels from the document tree", () => {
		renderBody({
			state: "idle",
			focusedTask: { id: 1, title: "Focus task" },
		});

		expect(screen.queryByTestId("daily-recap-panel")).toBeNull();
		expect(screen.queryByTestId("focus-budget-prompt")).toBeNull();
		expect(screen.queryByTestId("home-focus-summary")).toBeNull();
	});

	it("rail content does not add filled primary CTAs to the decision region", () => {
		usePomodoroCycleMock.mockReturnValue(
			makePomodoroMock({
				state: "idle",
				focusedTaskId: null,
				pendingKickoffSuggestion: kickoffSuggestionReady,
			}),
		);

		render(
			<PomodoroDashboardBody
				cycleEndAudioMode="muted"
				dayPlan={mockDayPlanWithBudget}
				enableSuggestionGate
				onboardingScope={authenticatedOnboardingScope}
				refreshTasks={async () => {}}
				setCycleEndAudioMode={vi.fn()}
				tasks={tasks}
			/>,
		);

		expect(getAcceptedRailBlocks(AUTH_RAIL_BLOCK_IDS).length).toBeGreaterThan(
			0,
		);
		expect(countEnabledPrimaryCtas()).toBe(1);
		expectInsideRegion("home-primary-region", "suggestion-accept-btn");
	});
});
