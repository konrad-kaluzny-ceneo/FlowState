import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainTask } from "~/lib/data-mode/types";

import { PomodoroDashboardBody } from "./pomodoro-dashboard";

const usePomodoroCycleMock = vi.fn();

vi.mock("~/hooks/use-pomodoro-cycle", () => ({
	usePomodoroCycle: (...args: unknown[]) => usePomodoroCycleMock(...args),
}));

vi.mock("~/hooks/use-e2e-expose-cycle-recovery", () => ({
	useE2eExposeCycleRecovery: () => {},
}));

vi.mock("./task-list", () => ({
	TaskList: () => <div data-testid="task-list-stub" />,
}));

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
		sortOrder: 0,
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
		midCyclePendingTask: null,
		isMidCycleSubmitting: false,
		awaitingCheckIn: false,
		isPostCheckInTransitioning: false,
		awaitingWindDown: false,
		windDownRationale: null,
		isConfirming: false,
		pendingSuggestion: { status: "idle" },
		pendingKickoffSuggestion: { status: "idle" },
		kickoffSuggestedTaskId: null,
		hasPreFocusedKickoff: false,
		hasPreFocusedSuggestion: false,
		stagedKickoffDurationSec: null,
		isAcceptingSuggestion: false,
		isAcceptingKickoffSuggestion: false,
		overrideAcknowledgement: null,
		kickoffEligible: false,
		awaitingKickoffReadiness: false,
		kickoffReadinessSubmitting: false,
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
		start: vi.fn(),
		interrupt: vi.fn(),
		confirmComplete: vi.fn(),
		onCycleCompleteConfirm: vi.fn(),
		submitCheckIn: vi.fn(),
		onWindDownKeepGoing: vi.fn(),
		onWindDownEndSession: vi.fn(),
		onMidCycleMarkComplete: vi.fn(),
		onMidCycleContinueWithTask: vi.fn(),
		onMidCycleEndCycleAndBreak: vi.fn(),
		submitKickoffReadiness: vi.fn(),
		skipKickoffReadiness: vi.fn(),
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
});
