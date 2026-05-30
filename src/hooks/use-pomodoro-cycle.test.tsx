import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainActiveCycle } from "~/lib/data-mode/types";
import type { TimerWorkerInbound } from "~/workers/timer-worker-logic";

const getOrCreateSession = vi.fn();
const createCycle = vi.fn();
const completeCycle = vi.fn();
const interruptCycle = vi.fn();
const getActiveCycle = vi.fn();
const invalidateGetActive = vi.fn();
const invalidateTaskList = vi.fn();

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

vi.mock("~/lib/audio", () => ({
	createAudioManager: () => ({
		unlock: vi.fn().mockResolvedValue(undefined),
		preload: vi.fn().mockResolvedValue(undefined),
		playAlarm: vi.fn().mockResolvedValue(undefined),
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
		},
		sessions: {
			getOrCreateActive: getOrCreateSession,
		},
		refreshGuest: vi.fn(),
	}),
}));

vi.mock("~/trpc/react", () => ({
	api: {
		useUtils: () => ({
			cycle: { getActive: { invalidate: invalidateGetActive } },
			task: { list: { invalidate: invalidateTaskList } },
		}),
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

describe("usePomodoroCycle", () => {
	beforeEach(() => {
		resetActiveCycleRecoveryForTests();
		activeCycleData = null;
		fakeWorkers.length = 0;
		vi.clearAllMocks();
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
		completeCycle.mockResolvedValue(undefined);
		interruptCycle.mockResolvedValue(undefined);
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

			// Now in break state — complete the break
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

		// The break auto-start will call createCycle — make it fail
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
});
