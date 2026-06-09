import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainActiveCycle } from "~/lib/data-mode/types";
import { assertRemainingMsWithinTolerance } from "~/test-utils/countdown-tolerance";
import type { TimerWorkerInbound } from "~/workers/timer-worker-logic";

const getOrCreateSession = vi.fn();
const endSession = vi.fn();
const createCycle = vi.fn();
const completeCycle = vi.fn();
const interruptCycle = vi.fn();
const rebindTask = vi.fn();
const updateTask = vi.fn();
const getActiveCycle = vi.fn();
const invalidateGetActive = vi.fn();
const invalidateTaskList = vi.fn();
const createCheckInMutate = vi.fn();
const suggestionNextMutate = vi.fn();
const recordDecisionMutate = vi.fn();
const taskListQuery = vi.fn();

let activeCycleData: DomainActiveCycle | null = null;

const fakeWorkers: FakeWorker[] = [];

class FakeWorker {
	onmessage: ((event: MessageEvent) => void) | null = null;
	endTime: number | null = null;
	private stopped = false;

	constructor() {
		fakeWorkers.push(this);
	}

	postMessage(message: TimerWorkerInbound) {
		if (message.type === "stop") {
			this.stopped = true;
			this.endTime = null;
			return;
		}
		if (message.type === "start") {
			this.stopped = false;
			this.endTime = message.endTime;
			this.emitTick();
		}
	}

	emitTick() {
		if (this.stopped || this.endTime === null || !this.onmessage) {
			return;
		}
		const remaining = this.endTime - Date.now();
		if (remaining <= 0) {
			this.onmessage({ data: { type: "complete" } } as MessageEvent);
			return;
		}
		this.onmessage({
			data: { type: "tick", remaining },
		} as MessageEvent);
	}

	terminate() {}
}

const playAlarm = vi.fn().mockResolvedValue(undefined);

vi.mock("~/lib/audio", () => ({
	createAudioManager: () => ({
		unlock: vi.fn().mockResolvedValue(undefined),
		preload: vi.fn().mockResolvedValue(undefined),
		playAlarm,
		dispose: vi.fn(),
	}),
}));

vi.mock("~/lib/data-mode/data-mode-context", () => ({
	useDataMode: () => "authenticated",
	useRepositories: () => ({
		cycles: {
			getActive: getActiveCycle,
			create: createCycle,
			complete: completeCycle,
			interrupt: interruptCycle,
			rebindTask,
		},
		tasks: {
			update: updateTask,
		},
		sessions: {
			getOrCreateActive: getOrCreateSession,
			end: endSession,
		},
		refreshGuest: vi.fn(),
	}),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			cycle: { getActive: { invalidate: invalidateGetActive } },
			task: { list: { invalidate: invalidateTaskList } },
			client: {
				cycle: {
					countCompletedWork: { query: vi.fn().mockResolvedValue(0) },
					list: { query: vi.fn().mockResolvedValue([]) },
				},
				task: { list: { query: taskListQuery } },
			},
		}),
		checkIn: {
			create: {
				useMutation: () => ({
					mutateAsync: createCheckInMutate,
				}),
			},
		},
		suggestion: {
			next: {
				useMutation: () => ({
					mutateAsync: suggestionNextMutate,
				}),
			},
			recordDecision: {
				useMutation: () => ({
					mutateAsync: recordDecisionMutate,
				}),
			},
		},
	},
}));

vi.stubGlobal("Worker", FakeWorker);

const { usePomodoroCycle, resetActiveCycleRecoveryForTests } = await import(
	"~/hooks/use-pomodoro-cycle"
);

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

function makeActiveCycle(
	overrides: Partial<DomainActiveCycle> = {},
): DomainActiveCycle {
	return {
		id: 99,
		sessionId: 1,
		userId: "user-1",
		taskId: 3,
		kind: "WORK",
		state: "RUNNING",
		configuredDurationSec: 120,
		startedAt: new Date(),
		endedAt: null,
		task: { id: 3, title: "Resume me" },
		...overrides,
	};
}

type PomodoroCycleHookResult = {
	current: ReturnType<typeof usePomodoroCycle>;
};

function assertNoCycleCompleteFlash(result: PomodoroCycleHookResult) {
	const {
		awaitingCheckIn,
		awaitingWindDown,
		isPostCheckInTransitioning,
		state,
	} = result.current;
	if (
		!awaitingCheckIn &&
		!awaitingWindDown &&
		!isPostCheckInTransitioning &&
		state === "completed"
	) {
		throw new Error(
			"Cycle complete flash window: completed state visible without gate suppression",
		);
	}
}

async function driveWorkCycleToCheckIn(result: PomodoroCycleHookResult) {
	await waitFor(() => {
		expect(result.current.state).toBe("running");
	});
	act(() => {
		fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
			data: { type: "complete" },
		} as MessageEvent);
	});
	expect(result.current.state).toBe("completed");
	await act(async () => {
		await result.current.onCycleCompleteConfirm(false);
	});
	expect(result.current.awaitingCheckIn).toBe(true);
}

function mockCompleteCycleDeferred() {
	let releaseCompleteCycle!: () => void;
	const completeBlocked = new Promise<void>((resolve) => {
		releaseCompleteCycle = resolve;
	});
	completeCycle.mockImplementation(async () => {
		await completeBlocked;
	});
	return { releaseCompleteCycle };
}

describe("usePomodoroCycle", () => {
	beforeEach(() => {
		resetActiveCycleRecoveryForTests();
		activeCycleData = null;
		fakeWorkers.length = 0;
		vi.clearAllMocks();
		playAlarm.mockClear();
		getActiveCycle.mockImplementation(async () => activeCycleData);
		getOrCreateSession.mockResolvedValue({ id: 1 });
		endSession.mockResolvedValue({ id: 1, state: "ENDED_BY_USER" });
		createCycle.mockImplementation(async () => ({
			id: 42,
			sessionId: 1,
			userId: "user-1",
			taskId: 7,
			kind: "WORK",
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: { id: 7, title: "Write tests" },
			configuredDurationSec: 60,
		}));
		completeCycle.mockResolvedValue(undefined);
		interruptCycle.mockResolvedValue(undefined);
		updateTask.mockResolvedValue(undefined);
		createCheckInMutate.mockResolvedValue({
			id: 1,
			cycleId: 11,
			energy: "STEADY",
			userId: "user-1",
			respondedAt: new Date(),
		});
		suggestionNextMutate.mockResolvedValue({
			cycleId: 70,
			taskId: 9,
			title: "Suggested task",
			workType: "DEEP_WORK",
			weight: 3,
			rationaleKey: "energy_deep",
			rationale: "Deep work — you're focused",
		});
		recordDecisionMutate.mockResolvedValue({
			id: 1,
			cycleId: 70,
			suggestedTaskId: 9,
			chosenTaskId: 9,
			accepted: true,
		});
		taskListQuery.mockResolvedValue([]);
		rebindTask.mockImplementation(async (input) => ({
			id: 99,
			sessionId: 1,
			userId: "user-1",
			taskId: input.taskId,
			kind: "WORK",
			state: "RUNNING",
			configuredDurationSec: 120,
			startedAt: new Date(),
			endedAt: null,
			task: { id: input.taskId, title: "Next task" },
		}));
	});

	it("starts idle and transitions to running on start()", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("idle");
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(getOrCreateSession).toHaveBeenCalled();
		expect(createCycle).toHaveBeenCalledWith({
			kind: "WORK",
			configuredDurationSec: 60,
			taskId: 7,
		});
		expect(result.current.state).toBe("running");
	});

	it("transitions to completed when worker completes", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		const worker = fakeWorkers[fakeWorkers.length - 1];
		expect(worker).toBeDefined();

		act(() => {
			worker?.onmessage?.({ data: { type: "complete" } } as MessageEvent);
		});

		expect(result.current.state).toBe("completed");
	});

	it("does not start another cycle while state is completed", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		const worker = fakeWorkers[fakeWorkers.length - 1];
		act(() => {
			worker?.onmessage?.({ data: { type: "complete" } } as MessageEvent);
		});

		expect(result.current.state).toBe("completed");

		createCycle.mockClear();

		await act(async () => {
			await result.current.start(60);
		});

		expect(createCycle).not.toHaveBeenCalled();
		expect(result.current.error).toMatch(/Finish or dismiss/);
	});

	it("resumes running state from getActive on mount", async () => {
		activeCycleData = makeActiveCycle();

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		expect(result.current.focusedTask).toMatchObject({
			id: 3,
			title: "Resume me",
		});
		expect(result.current.remainingMs).toBeGreaterThan(0);
	});

	it("calls interrupt and returns to idle", async () => {
		activeCycleData = makeActiveCycle({
			id: 10,
			configuredDurationSec: 300,
			taskId: 2,
			task: { id: 2, title: "Focus" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		await act(async () => {
			await result.current.interrupt();
		});

		expect(interruptCycle).toHaveBeenCalledWith({ cycleId: 10 });
		expect(result.current.state).toBe("idle");
	});

	it("confirmComplete calls complete and auto-starts break", async () => {
		activeCycleData = makeActiveCycle({
			id: 11,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		// Mock break cycle creation
		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 100,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.confirmComplete(true);
		});

		expect(completeCycle).toHaveBeenCalledWith({
			cycleId: 11,
			markTaskDone: true,
		});
		// After work cycle complete, break auto-starts
		expect(result.current.state).toBe("running");
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
	});

	it("after 4th work cycle, long break triggers", async () => {
		// Mock break cycle creation
		createCycle.mockImplementation(async (input) => ({
			id: Math.random(),
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("idle");
		});

		// Simulate 4 work cycles completing
		for (let i = 0; i < 4; i++) {
			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			// Complete the work cycle
			act(() => {
				fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
					data: { type: "complete" },
				} as MessageEvent);
			});

			await act(async () => {
				await result.current.confirmComplete(false);
			});

			// Now in break state â€” complete the break
			if (i < 3) {
				// Short breaks for first 3
				expect(result.current.cycleKind).toBe("SHORT_BREAK");
			} else {
				// 4th should be long break
				expect(result.current.cycleKind).toBe("LONG_BREAK");
			}

			// Complete the break
			act(() => {
				fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
					data: { type: "complete" },
				} as MessageEvent);
			});

			await act(async () => {
				await result.current.confirmComplete(false);
			});

			expect(result.current.state).toBe("idle");
		}
	});

	it("break complete returns to idle", async () => {
		// Start with a break cycle active (simulating recovery)
		activeCycleData = makeActiveCycle({
			id: 20,
			kind: "SHORT_BREAK",
			configuredDurationSec: 300,
			taskId: null,
			task: null,
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		expect(result.current.cycleKind).toBe("SHORT_BREAK");

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.confirmComplete(false);
		});

		expect(result.current.state).toBe("idle");
		expect(result.current.cycleKind).toBeNull();
	});

	it("break creation failure after work complete shows error and resets to idle", async () => {
		activeCycleData = makeActiveCycle({
			id: 30,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		// The break auto-start will call createCycle â€” make it fail
		createCycle.mockRejectedValue(new Error("network error"));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.confirmComplete(false);
		});

		expect(result.current.state).toBe("idle");
		expect(result.current.error).toMatch(/Break could not start/);
	});

	it("shows completed when recovered cycle already expired", async () => {
		activeCycleData = makeActiveCycle({
			startedAt: new Date(Date.now() - 120_000),
			configuredDurationSec: 60,
			task: { id: 3, title: "Late" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("completed");
		});

		expect(result.current.remainingMs).toBe(0);
		expect(playAlarm).toHaveBeenCalled();
		expect(fakeWorkers).toHaveLength(0);
	});

	it("starts worker with correct endTime when resuming active cycle", async () => {
		const startedAt = new Date(Date.now() - 30_000);
		const durationSec = 120;
		activeCycleData = makeActiveCycle({
			startedAt,
			configuredDurationSec: durationSec,
		});

		renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(fakeWorkers.length).toBeGreaterThan(0);
		});

		const worker = fakeWorkers[0];
		const expectedEnd = startedAt.getTime() + durationSec * 1000;
		expect(worker?.endTime).toBe(expectedEnd);
	});

	it("sets error when start fails", async () => {
		createCycle.mockRejectedValueOnce(new Error("network"));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(result.current.error).toMatch(/Could not start/);
		expect(result.current.state).toBe("idle");
	});

	it("uses fallback timer when Worker constructor throws", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);

		vi.useFakeTimers();
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(result.current.state).toBe("running");

		await act(async () => {
			vi.advanceTimersByTime(61_000);
		});

		expect(result.current.state).toBe("completed");
		vi.useRealTimers();
		vi.stubGlobal("Worker", FakeWorker);
	});

	it("recalculates remaining within Â±2s when tab becomes visible (fallback path)", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);

		const durationSec = 120;
		const startMs = Date.now() - 10_000;
		activeCycleData = makeActiveCycle({
			startedAt: new Date(startMs),
			configuredDurationSec: durationSec,
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		const endTimeMs = startMs + durationSec * 1000;
		const staleRemaining = result.current.remainingMs;

		vi.useFakeTimers();
		vi.setSystemTime(startMs + 45_000);

		try {
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "visible",
			});

			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			assertRemainingMsWithinTolerance(
				result.current.remainingMs,
				endTimeMs,
				2000,
				startMs + 45_000,
			);
			expect(result.current.remainingMs).toBeLessThan(staleRemaining);
			expect(result.current.state).toBe("running");
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("endSession calls sessions.end and resets state", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("idle");
		});

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(result.current.hasActiveSession).toBe(true);
		expect(result.current.state).toBe("running");

		// Interrupt to get to idle state (endSession requires non-running or handles it)
		await act(async () => {
			await result.current.interrupt();
		});

		expect(result.current.state).toBe("idle");
		expect(result.current.hasActiveSession).toBe(true);

		await act(async () => {
			await result.current.endSession();
		});

		expect(endSession).toHaveBeenCalled();
		expect(result.current.state).toBe("idle");
		expect(result.current.hasActiveSession).toBe(false);
		expect(result.current.focusedTask).toBeNull();
	});

	it("endSession interrupts running cycle before ending session", async () => {
		activeCycleData = makeActiveCycle({
			id: 50,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		await act(async () => {
			await result.current.endSession();
		});

		expect(interruptCycle).toHaveBeenCalledWith({ cycleId: 50 });
		expect(endSession).toHaveBeenCalled();
		expect(result.current.state).toBe("idle");
		expect(result.current.hasActiveSession).toBe(false);
	});

	it("WORK cycle-end requires check-in before break starts", async () => {
		activeCycleData = makeActiveCycle({
			id: 70,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 300,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		expect(result.current.state).toBe("completed");

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		expect(result.current.awaitingCheckIn).toBe(true);
		expect(completeCycle).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		expect(createCheckInMutate).toHaveBeenCalledWith({
			cycleId: 70,
			energy: "FOCUSED",
		});
		expect(completeCycle).toHaveBeenCalledWith({
			cycleId: 70,
			markTaskDone: false,
		});
		expect(result.current.awaitingCheckIn).toBe(false);
		expect(result.current.state).toBe("running");
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
	});

	it("submitCheckIn keeps cycle-complete suppressed until break running", async () => {
		activeCycleData = makeActiveCycle({
			id: 70,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 300,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { releaseCompleteCycle } = mockCompleteCycleDeferred();

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await driveWorkCycleToCheckIn(result);

		let submitPromise!: Promise<void>;
		act(() => {
			submitPromise = result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			assertNoCycleCompleteFlash(result);
			expect(result.current.isPostCheckInTransitioning).toBe(true);
			expect(result.current.state).toBe("completed");
			expect(result.current.awaitingCheckIn).toBe(true);
		});

		releaseCompleteCycle();

		await act(async () => {
			await submitPromise;
		});

		assertNoCycleCompleteFlash(result);
		expect(result.current.awaitingCheckIn).toBe(false);
		expect(result.current.state).toBe("running");
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
	});

	it("onWindDownKeepGoing keeps cycle-complete suppressed until break running", async () => {
		activeCycleData = makeActiveCycle({
			id: 72,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});
		getOrCreateSession.mockResolvedValue({ id: 1, interruptionCount: 3 });

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 302,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await driveWorkCycleToCheckIn(result);

		await act(async () => {
			await result.current.submitCheckIn("FADING");
		});

		expect(result.current.awaitingWindDown).toBe(true);
		expect(result.current.awaitingCheckIn).toBe(false);
		assertNoCycleCompleteFlash(result);

		const { releaseCompleteCycle } = mockCompleteCycleDeferred();

		let keepGoingPromise!: Promise<void>;
		act(() => {
			keepGoingPromise = result.current.onWindDownKeepGoing();
		});

		await waitFor(() => {
			assertNoCycleCompleteFlash(result);
			expect(result.current.isPostCheckInTransitioning).toBe(true);
		});

		releaseCompleteCycle();

		await act(async () => {
			await keepGoingPromise;
		});

		assertNoCycleCompleteFlash(result);
		expect(result.current.state).toBe("running");
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
	});

	it("wind-down after check-in suppresses cycle-complete without transition flag", async () => {
		activeCycleData = makeActiveCycle({
			id: 73,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});
		getOrCreateSession.mockResolvedValue({ id: 1, interruptionCount: 3 });

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await driveWorkCycleToCheckIn(result);

		await act(async () => {
			await result.current.submitCheckIn("FADING");
		});

		assertNoCycleCompleteFlash(result);
		expect(result.current.awaitingWindDown).toBe(true);
		expect(result.current.awaitingCheckIn).toBe(false);
		expect(result.current.isPostCheckInTransitioning).toBe(false);
	});

	it("confirmComplete failure keeps check-in retryable", async () => {
		activeCycleData = makeActiveCycle({
			id: 74,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 301,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		completeCycle
			.mockRejectedValueOnce(new Error("network"))
			.mockRejectedValueOnce(new Error("network"));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await driveWorkCycleToCheckIn(result);

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		assertNoCycleCompleteFlash(result);
		expect(result.current.awaitingCheckIn).toBe(true);
		expect(result.current.isPostCheckInTransitioning).toBe(false);
		expect(completeCycle).toHaveBeenCalledTimes(2);

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		expect(completeCycle).toHaveBeenCalledTimes(3);
		expect(completeCycle).toHaveBeenLastCalledWith({
			cycleId: 74,
			markTaskDone: false,
		});
		expect(result.current.awaitingCheckIn).toBe(false);
		expect(result.current.state).toBe("running");
	});

	it("break cycle-end skips check-in gate", async () => {
		activeCycleData = makeActiveCycle({
			id: 71,
			kind: "SHORT_BREAK",
			configuredDurationSec: 300,
			taskId: null,
			task: null,
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		expect(result.current.awaitingCheckIn).toBe(false);
		expect(createCheckInMutate).not.toHaveBeenCalled();
		expect(completeCycle).toHaveBeenCalledWith({
			cycleId: 71,
			markTaskDone: false,
		});
		expect(result.current.state).toBe("idle");
	});

	it("mid-cycle continue preserves running state and rebinds task", async () => {
		activeCycleData = makeActiveCycle({
			id: 60,
			taskId: 4,
			task: { id: 4, title: "Current" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		const remainingBefore = result.current.remainingMs;

		act(() => {
			result.current.onMidCycleMarkComplete(4, { id: 4, title: "Current" });
		});

		expect(result.current.midCyclePendingTask).toMatchObject({
			id: 4,
			title: "Current",
		});

		await act(async () => {
			await result.current.onMidCycleContinueWithTask(8, {
				id: 8,
				title: "Next",
			});
		});

		expect(updateTask).toHaveBeenCalledWith({ id: 4, status: "completed" });
		expect(rebindTask).toHaveBeenCalledWith({ cycleId: 60, taskId: 8 });
		expect(result.current.state).toBe("running");
		expect(result.current.focusedTask).toMatchObject({ id: 8, title: "Next" });
		expect(result.current.midCyclePendingTask).toBeNull();
		expect(result.current.remainingMs).toBe(remainingBefore);
	});

	it("mid-cycle end-break completes work cycle and starts break", async () => {
		activeCycleData = makeActiveCycle({
			id: 61,
			taskId: 4,
			task: { id: 4, title: "Done now" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 200,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			result.current.onMidCycleMarkComplete(4, { id: 4, title: "Done now" });
		});

		await act(async () => {
			await result.current.onMidCycleEndCycleAndBreak();
		});

		expect(result.current.awaitingCheckIn).toBe(true);
		expect(result.current.midCyclePendingTask).toBeNull();
		expect(completeCycle).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.submitCheckIn("STEADY");
		});

		expect(createCheckInMutate).toHaveBeenCalledWith({
			cycleId: 61,
			energy: "STEADY",
		});
		expect(completeCycle).toHaveBeenCalledWith({
			cycleId: 61,
			markTaskDone: true,
			incrementInterruption: true,
		});
		expect(result.current.awaitingCheckIn).toBe(false);
		expect(result.current.state).toBe("running");
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
	});

	it("fetches suggestion after check-in and break starts", async () => {
		activeCycleData = makeActiveCycle({
			id: 80,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 400,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			expect(result.current.pendingSuggestion.status).toBe("ready");
		});

		expect(suggestionNextMutate).toHaveBeenCalledWith(
			expect.objectContaining({ cycleId: 80 }),
		);
		expect(result.current.cycleKind).toBe("SHORT_BREAK");
		expect(result.current.suggestedTaskId).toBe(9);
	});

	it("calls completeCycle before suggestionNext after check-in", async () => {
		activeCycleData = makeActiveCycle({
			id: 80,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 400,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const callOrder: string[] = [];
		completeCycle.mockImplementation(async () => {
			callOrder.push("completeCycle");
		});
		suggestionNextMutate.mockImplementation(async () => {
			callOrder.push("suggestionNext");
			return {
				cycleId: 80,
				taskId: 9,
				title: "Suggested task",
				workType: "DEEP_WORK",
				weight: 3,
				rationaleKey: "energy_deep",
				rationale: "Deep work — you're focused",
			};
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		expect(callOrder).toEqual(["completeCycle", "suggestionNext"]);
	});

	it("does not call recordDecision when focusing during suggestion loading", async () => {
		activeCycleData = makeActiveCycle({
			id: 84,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 404,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		let resolveSuggestion: (value: unknown) => void = () => {};
		suggestionNextMutate.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveSuggestion = resolve;
				}),
		);

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			void result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			expect(result.current.pendingSuggestion.status).toBe("loading");
		});

		recordDecisionMutate.mockClear();

		act(() => {
			result.current.selectTask(12, { id: 12, title: "Other task" });
		});

		expect(recordDecisionMutate).not.toHaveBeenCalled();
		expect(result.current.focusedTaskId).not.toBe(12);

		await act(async () => {
			resolveSuggestion({
				cycleId: 84,
				taskId: 9,
				title: "Suggested task",
				workType: "DEEP_WORK",
				weight: 3,
				rationaleKey: "energy_deep",
				rationale: "Deep work — you're focused",
			});
		});
	});

	it("acceptSuggestion records decision and pre-focuses task", async () => {
		activeCycleData = makeActiveCycle({
			id: 81,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 401,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			expect(result.current.pendingSuggestion.status).toBe("ready");
		});

		await act(async () => {
			await result.current.acceptSuggestion();
		});

		expect(recordDecisionMutate).toHaveBeenCalledWith({
			context: "post_check_in",
			cycleId: 81,
			suggestedTaskId: 9,
			chosenTaskId: 9,
		});
		expect(result.current.preFocusedTask).toMatchObject({
			id: 9,
			title: "Suggested task",
		});
		expect(result.current.hasPreFocusedSuggestion).toBe(true);
	});

	it("override via selectTask during break records override decision", async () => {
		activeCycleData = makeActiveCycle({
			id: 82,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 402,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			expect(result.current.pendingSuggestion.status).toBe("ready");
		});

		recordDecisionMutate.mockClear();

		act(() => {
			result.current.selectTask(12, { id: 12, title: "Other task" });
		});

		await waitFor(() => {
			expect(recordDecisionMutate).toHaveBeenCalledWith({
				context: "post_check_in",
				cycleId: 82,
				suggestedTaskId: 9,
				chosenTaskId: 12,
			});
		});

		expect(result.current.suggestedTaskId).toBeNull();
		expect(result.current.focusedTaskId).toBe(12);
		expect(result.current.overrideAcknowledgement).toMatch(/noted/i);
	});

	it("acceptSuggestion does not show override acknowledgement", async () => {
		activeCycleData = makeActiveCycle({
			id: 83,
			configuredDurationSec: 300,
			taskId: 4,
			task: { id: 4, title: "Ship" },
		});

		createCycle.mockImplementation(async (input) => ({
			id: input.kind === "WORK" ? 42 : 403,
			sessionId: 1,
			userId: "user-1",
			taskId: null,
			kind: input.kind,
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: null,
			configuredDurationSec: input.configuredDurationSec,
		}));

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
				data: { type: "complete" },
			} as MessageEvent);
		});

		await act(async () => {
			await result.current.onCycleCompleteConfirm(false);
		});

		await act(async () => {
			await result.current.submitCheckIn("FOCUSED");
		});

		await waitFor(() => {
			expect(result.current.pendingSuggestion.status).toBe("ready");
		});

		await act(async () => {
			await result.current.acceptSuggestion();
		});

		expect(result.current.overrideAcknowledgement).toBeNull();
	});

	it("blocks selectTask during WORK running", async () => {
		activeCycleData = makeActiveCycle({
			id: 84,
			taskId: 4,
			task: { id: 4, title: "Current" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		act(() => {
			result.current.selectTask(99, { id: 99, title: "Blocked" });
		});

		expect(result.current.focusedTaskId).toBe(4);
	});

	it("hasActiveSession is true after first cycle start, false after endSession", async () => {
		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("idle");
		});

		expect(result.current.hasActiveSession).toBe(false);

		act(() => {
			result.current.selectTask(7, { id: 7, title: "Write tests" });
		});

		await act(async () => {
			await result.current.start(60);
		});

		expect(result.current.hasActiveSession).toBe(true);

		// Interrupt to get back to idle
		await act(async () => {
			await result.current.interrupt();
		});

		// Still has active session after interrupt
		expect(result.current.hasActiveSession).toBe(true);

		await act(async () => {
			await result.current.endSession();
		});

		expect(result.current.hasActiveSession).toBe(false);
	});

	describe("kickoff suggestion eligibility", () => {
		const activeTaskList = [
			{
				id: 7,
				title: "Write tests",
				status: "active" as const,
				workType: "DEEP_WORK" as const,
				weight: 2,
				userId: "user-1",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		];

		const kickoffSuggestion = {
			sessionId: 1,
			taskId: 9,
			title: "Kickoff task",
			workType: "DEEP_WORK" as const,
			weight: 3,
			rationaleKey: "kickoff_fresh",
			rationale: "Start with deep work",
		};

		it("fetches kickoff suggestion after break complete without pre-focus", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return {
					cycleId: 70,
					taskId: 9,
					title: "Suggested task",
					workType: "DEEP_WORK",
					weight: 3,
					rationaleKey: "energy_deep",
					rationale: "Deep work — you're focused",
				};
			});

			activeCycleData = makeActiveCycle({
				id: 20,
				kind: "SHORT_BREAK",
				configuredDurationSec: 300,
				taskId: null,
				task: null,
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.state).toBe("running");
			});

			act(() => {
				fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
					data: { type: "complete" },
				} as MessageEvent);
			});

			await act(async () => {
				await result.current.confirmComplete(false);
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			expect(suggestionNextMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					context: "kickoff",
					sessionId: 1,
				}),
			);
			expect(getOrCreateSession).toHaveBeenCalled();
			expect(result.current.pendingSuggestion.status).toBe("idle");
		});

		it("does not fetch kickoff when clearTask clears mid-session focus", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			activeCycleData = makeActiveCycle({
				id: 55,
				taskId: 7,
				task: { id: 7, title: "Write tests" },
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.state).toBe("running");
			});

			await act(async () => {
				await result.current.interrupt();
			});

			expect(result.current.state).toBe("idle");
			expect(result.current.focusedTaskId).toBe(7);

			suggestionNextMutate.mockClear();
			getOrCreateSession.mockClear();

			act(() => {
				result.current.clearTask();
			});

			await waitFor(() => {
				expect(result.current.focusedTaskId).toBeNull();
			});

			expect(suggestionNextMutate).not.toHaveBeenCalledWith(
				expect.objectContaining({ context: "kickoff" }),
			);
		});

		it("clears kickoff suggestion on start()", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return null;
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			expect(result.current.pendingKickoffSuggestion.status).toBe("idle");
		});

		it("kickoff override via selectTask during idle shows override acknowledgement", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return null;
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			recordDecisionMutate.mockClear();

			act(() => {
				result.current.selectTask(12, { id: 12, title: "Other task" });
			});

			await waitFor(() => {
				expect(recordDecisionMutate).toHaveBeenCalledWith({
					context: "kickoff",
					sessionId: 1,
					suggestedTaskId: 9,
					chosenTaskId: 12,
				});
			});

			expect(result.current.kickoffSuggestedTaskId).toBeNull();
			expect(result.current.focusedTaskId).toBe(12);
			expect(result.current.overrideAcknowledgement).toMatch(/noted/i);
		});

		it("acceptKickoffSuggestion does not show override acknowledgement", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return null;
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			await act(async () => {
				await result.current.acceptKickoffSuggestion();
			});

			expect(result.current.overrideAcknowledgement).toBeNull();
			expect(result.current.hasPreFocusedKickoff).toBe(true);
			expect(result.current.focusedTaskId).toBe(9);
		});

		it("dismissPreFocus after kickoff accept records kickoff decision", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return null;
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			await act(async () => {
				await result.current.acceptKickoffSuggestion();
			});

			recordDecisionMutate.mockClear();

			act(() => {
				result.current.dismissPreFocus();
			});

			await waitFor(() => {
				expect(recordDecisionMutate).toHaveBeenCalledWith({
					context: "kickoff",
					sessionId: 1,
					suggestedTaskId: 9,
					chosenTaskId: 9,
				});
			});

			expect(result.current.focusedTaskId).toBeNull();
			expect(result.current.hasPreFocusedKickoff).toBe(false);
		});

		it("kickoff override acknowledgement auto-dismisses after 3s", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return null;
			});

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.pendingKickoffSuggestion.status).toBe("ready");
			});

			vi.useFakeTimers();
			try {
				act(() => {
					result.current.selectTask(12, { id: 12, title: "Other task" });
				});

				expect(result.current.overrideAcknowledgement).toMatch(/noted/i);

				act(() => {
					vi.advanceTimersByTime(3_000);
				});

				expect(result.current.overrideAcknowledgement).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});

		it("keeps kickoff and post-check-in suggestion states independent", async () => {
			taskListQuery.mockResolvedValue(activeTaskList);
			suggestionNextMutate.mockImplementation(async (input) => {
				if (input.context === "kickoff") {
					return kickoffSuggestion;
				}
				return {
					cycleId: 80,
					taskId: 9,
					title: "Suggested task",
					workType: "DEEP_WORK",
					weight: 3,
					rationaleKey: "energy_deep",
					rationale: "Deep work — you're focused",
				};
			});

			activeCycleData = makeActiveCycle({
				id: 80,
				configuredDurationSec: 300,
				taskId: 4,
				task: { id: 4, title: "Ship" },
			});

			createCycle.mockImplementation(async (input) => ({
				id: input.kind === "WORK" ? 42 : 400,
				sessionId: 1,
				userId: "user-1",
				taskId: null,
				kind: input.kind,
				state: "RUNNING",
				startedAt: new Date(),
				endedAt: null,
				task: null,
				configuredDurationSec: input.configuredDurationSec,
			}));

			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			await waitFor(() => {
				expect(result.current.state).toBe("running");
			});

			act(() => {
				fakeWorkers[fakeWorkers.length - 1]?.onmessage?.({
					data: { type: "complete" },
				} as MessageEvent);
			});

			await act(async () => {
				await result.current.onCycleCompleteConfirm(false);
			});

			await act(async () => {
				await result.current.submitCheckIn("FOCUSED");
			});

			await waitFor(() => {
				expect(result.current.pendingSuggestion.status).toBe("ready");
			});

			expect(result.current.pendingKickoffSuggestion.status).toBe("idle");
			expect(suggestionNextMutate).toHaveBeenCalledWith(
				expect.objectContaining({ context: "post_check_in", cycleId: 80 }),
			);
			expect(suggestionNextMutate).not.toHaveBeenCalledWith(
				expect.objectContaining({ context: "kickoff" }),
			);
		});
	});
});

describe("usePomodoroCycle catchUp", () => {
	function setVisibilityState(state: DocumentVisibilityState) {
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => state,
		});
	}

	afterEach(() => {
		vi.useRealTimers();
	});

	beforeEach(() => {
		resetActiveCycleRecoveryForTests();
		activeCycleData = null;
		fakeWorkers.length = 0;
		vi.clearAllMocks();
		playAlarm.mockClear();
		vi.useRealTimers();
		setVisibilityState("visible");
		getActiveCycle.mockImplementation(async () => activeCycleData);
		getOrCreateSession.mockResolvedValue({ id: 1 });
		createCycle.mockImplementation(async () => ({
			id: 42,
			sessionId: 1,
			userId: "user-1",
			taskId: 7,
			kind: "WORK",
			state: "RUNNING",
			startedAt: new Date(),
			endedAt: null,
			task: { id: 7, title: "Write tests" },
			configuredDurationSec: 60,
		}));
	});

	it("passes muted mode to playAlarm while still setting catchUp when hidden", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);
		setVisibilityState("hidden");

		vi.useFakeTimers();
		try {
			const { result } = renderHook(
				() =>
					usePomodoroCycle({
						getCycleEndAudioMode: () => "muted",
					}),
				{ wrapper: createWrapper() },
			);

			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			await act(async () => {
				vi.advanceTimersByTime(61_000);
			});

			expect(result.current.state).toBe("completed");
			expect(playAlarm).toHaveBeenCalledWith({ mode: "muted" });
			expect(result.current.catchUp).toMatchObject({
				endedWhileHidden: true,
				gate: "WORK_CONFIRM",
			});
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("sets catchUp when cycle expires while tab is hidden", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);
		setVisibilityState("hidden");

		vi.useFakeTimers();
		try {
			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			await act(async () => {
				vi.advanceTimersByTime(61_000);
			});

			expect(result.current.state).toBe("completed");
			expect(result.current.catchUp).toMatchObject({
				endedWhileHidden: true,
				gate: "WORK_CONFIRM",
			});
			expect(result.current.catchUp?.cycleEndedAtMs).toBeGreaterThan(0);
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("does not set catchUp when cycle expires while tab is visible", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);
		setVisibilityState("visible");

		vi.useFakeTimers();
		try {
			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			await act(async () => {
				vi.advanceTimersByTime(61_000);
			});

			expect(result.current.state).toBe("completed");
			expect(result.current.catchUp).toBeNull();
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("sets catchUp via visibility recalc when tab was hidden while running", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);

		const durationSec = 60;
		const startMs = Date.now() - 30_000;
		activeCycleData = makeActiveCycle({
			startedAt: new Date(startMs),
			configuredDurationSec: durationSec,
		});

		const endTimeMs = startMs + durationSec * 1000;

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("running");
		});

		vi.useFakeTimers();
		vi.setSystemTime(startMs + 30_000);

		try {
			setVisibilityState("hidden");
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			vi.setSystemTime(endTimeMs + 5_000);

			setVisibilityState("visible");
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			expect(result.current.state).toBe("completed");
			expect(result.current.catchUp).toMatchObject({
				endedWhileHidden: true,
				gate: "WORK_CONFIRM",
				cycleEndedAtMs: endTimeMs,
			});
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});

	it("sets catchUp when recovered cycle already expired", async () => {
		activeCycleData = makeActiveCycle({
			startedAt: new Date(Date.now() - 120_000),
			configuredDurationSec: 60,
			task: { id: 3, title: "Late" },
		});

		const { result } = renderHook(() => usePomodoroCycle(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.state).toBe("completed");
		});

		expect(result.current.catchUp).toMatchObject({
			endedWhileHidden: true,
			gate: "WORK_CONFIRM",
		});
	});

	it("clears catchUp on dismiss and does not re-show on visibilitychange", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker blocked");
				}
			},
		);
		setVisibilityState("hidden");

		vi.useFakeTimers();
		try {
			const { result } = renderHook(() => usePomodoroCycle(), {
				wrapper: createWrapper(),
			});

			act(() => {
				result.current.selectTask(7, { id: 7, title: "Write tests" });
			});

			await act(async () => {
				await result.current.start(60);
			});

			await act(async () => {
				vi.advanceTimersByTime(61_000);
			});

			expect(result.current.catchUp).not.toBeNull();

			act(() => {
				result.current.dismissCatchUp();
			});

			expect(result.current.catchUp).toBeNull();

			setVisibilityState("visible");
			await act(async () => {
				document.dispatchEvent(new Event("visibilitychange"));
			});

			expect(result.current.catchUp).toBeNull();
		} finally {
			vi.useRealTimers();
			vi.stubGlobal("Worker", FakeWorker);
		}
	});
});
